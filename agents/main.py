import logging
import operator
from typing import Annotated, TypedDict

import bs4
from langchain_community.document_loaders import WebBaseLoader
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

MAX_RETRY = 2
FETCH_TIMEOUT = 10
CONTENT_LIMIT = 4000
_SKIP_EXTENSIONS = (".pdf", ".docx", ".xlsx", ".ppt", ".pptx", ".zip", ".png", ".jpg")
# Q&A サイト・入試ブログなど低品質ソースを除外
_SKIP_DOMAINS = ("chiebukuro.yahoo.co.jp", "detail.chiebukuro", "oya-gakubu.com", "passnavi.com", "benesse.jp")

_llm = ChatOllama(model="qwen3")


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------


class ResearchState(TypedDict):
    question: str
    retry_count: int
    answer_retry_count: int
    search_results: list[dict]  # last-write-wins: current batch only
    fetched_contents: Annotated[list[dict], operator.add]  # accumulates across retries
    errors: Annotated[list[str], operator.add]
    answer: str


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


def _build_query(question: str, answer_retry_count: int) -> str:
    """Build search query; use press-release-targeted query on answer retry."""
    if answer_retry_count == 0:
        return question
    import re
    core = re.sub(r"(現在の|は？|ですか？|を教えてください)", "", question).strip()
    return f"{core} 就任 プレスリリース"


def search_node(state: ResearchState) -> dict:
    """Search for relevant URLs via DuckDuckGo."""
    question = state["question"]
    retry_count = state.get("retry_count", 0)
    answer_retry_count = state.get("answer_retry_count", 0)
    query = _build_query(question, answer_retry_count)

    logger.info("🔍 Searching (retry=%d): %s", retry_count, query)

    try:
        searcher = DuckDuckGoSearchResults(
            api_wrapper=DuckDuckGoSearchAPIWrapper(backend="duckduckgo"),
            output_format="list",
            num_results=5,
        )
        raw = searcher.invoke(query)
        # Filter out non-HTML resources and low-quality domains
        results = [
            r for r in raw
            if not r["link"].lower().endswith(_SKIP_EXTENSIONS)
            and not any(d in r["link"] for d in _SKIP_DOMAINS)
        ]
    except Exception as exc:
        logger.warning("Search failed: %s", exc)
        return {
            "search_results": [],
            "errors": [str(exc)],
            "retry_count": retry_count + 1,
        }

    logger.info("✓ Found %d results (filtered from %d)", len(results), len(raw))
    return {"search_results": results, "retry_count": retry_count + 1}


def fetch_one_node(state: ResearchState) -> dict:
    """Fetch content from a single URL (used in parallel fan-out via Send)."""
    # When invoked via Send, the state contains the individual result injected
    # under "search_results" as a single-element list.
    result = state["search_results"][0]
    url = result["link"]
    logger.info("  📥 Fetching: %s", url)

    try:
        loader = WebBaseLoader(
            url,
            header_template={"User-Agent": "Mozilla/5.0 (compatible; research-agent/1.0)"},
            bs_kwargs={"parse_only": bs4.SoupStrainer(["p", "h1", "h2", "h3", "li", "td", "th", "tr", "table"])},
            raise_for_status=True,
            show_progress=False,
        )
        docs = loader.load()
        content = docs[0].page_content[:CONTENT_LIMIT] if docs else result["snippet"]
        logger.info("    ✓ %d chars", len(content))
        return {
            "fetched_contents": [
                {"url": url, "title": result["title"], "content": content, "snippet": result["snippet"]}
            ]
        }
    except Exception as exc:
        logger.warning("    ✗ Failed %s: %s", url, exc)
        return {
            "fetched_contents": [
                {"url": url, "title": result["title"], "content": result["snippet"], "snippet": result["snippet"]}
            ],
            "errors": [f"fetch {url}: {exc}"],
        }


def answer_node(state: ResearchState) -> dict:
    """Analyze fetched content and generate answer."""
    logger.info("🤔 Generating answer...")

    context_parts: list[str] = []
    for i, item in enumerate(state["fetched_contents"], 1):
        context_parts.append(f"--- Source {i}: {item['title']} ---")
        context_parts.append(f"URL: {item['url']}")
        context_parts.append(item["content"])
        context_parts.append("")
    context = "\n".join(context_parts)

    messages = [
        SystemMessage(
            content=(
                "あなたはリサーチアシスタントです。ユーザーの質問に直接的かつ簡潔に日本語で答えてください。\n"
                "- 質問で求められている具体的な情報を抽出してください\n"
                "- 回答は短く（1-3文）してください\n"
                "- 情報を見つけたソースのURLを引用してください\n"
                "- 情報がソースにない場合は、そう明記してください\n"
                "- 必ず日本語で回答してください"
            )
        ),
        HumanMessage(
            content=f"質問: {state['question']}\n\nソース:\n{context}\n\n簡潔に日本語で回答してください:"
        ),
    ]

    response = _llm.invoke(messages)
    logger.info("✓ Answer generated (%d chars)", len(response.content))
    return {
        "answer": response.content,
        "answer_retry_count": state.get("answer_retry_count", 0) + 1,
    }


# ---------------------------------------------------------------------------
# Conditional edges
# ---------------------------------------------------------------------------


_NO_ANSWER_PHRASES = (
    "含まれていません",
    "見つかりません",
    "情報がない",
    "ソースにない",
    "情報はありません",
    "記載がありません",
)


def route_after_answer(state: ResearchState) -> str:
    """Retry search if the answer indicates the information was not found."""
    answer = state.get("answer", "")
    answer_retry_count = state.get("answer_retry_count", 0)
    if any(phrase in answer for phrase in _NO_ANSWER_PHRASES) and answer_retry_count <= MAX_RETRY:
        logger.info("Answer insufficient (retry=%d), searching again...", answer_retry_count)
        return "search"
    return END


def route_after_search(state: ResearchState) -> list[Send] | str:
    """Fan-out to fetch_one per result, or retry search if empty."""
    results = state.get("search_results", [])
    if not results:
        retry_count = state.get("retry_count", 0)
        if retry_count < MAX_RETRY:
            logger.info("No results, retrying search...")
            return "search"
        logger.warning(
            "No results after %d retries, proceeding with empty context", retry_count
        )
        return "answer"

    # Parallel fan-out: one Send per search result
    return [
        Send("fetch_one", {**state, "search_results": [result]}) for result in results
    ]


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------


def build_graph() -> StateGraph:
    g = StateGraph(ResearchState)

    g.add_node("search", search_node)
    g.add_node("fetch_one", fetch_one_node)
    g.add_node("answer", answer_node)

    g.add_edge(START, "search")
    g.add_conditional_edges(
        "search", route_after_search, ["search", "fetch_one", "answer"]
    )
    g.add_edge("fetch_one", "answer")
    g.add_conditional_edges("answer", route_after_answer, ["search", END])

    return g.compile()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    import sys

    question = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "現在の兵庫県立大学 社会情報科学部の学部長は？"
    )

    agent = build_graph()
    result = agent.invoke({"question": question, "retry_count": 0, "answer_retry_count": 0})

    print("\n" + "=" * 80)
    print("📋 FINAL ANSWER")
    print("=" * 80)
    print(result["answer"])
    if result.get("errors"):
        print("\n⚠ Errors:")
        for err in result["errors"]:
            print(f"  - {err}")
    print("=" * 80)
