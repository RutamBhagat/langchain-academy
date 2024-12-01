# %%

import os
from typing import Annotated
from dotenv import load_dotenv
from langgraph.graph import END, START, MessagesState, StateGraph
from pydantic import Field
from langchain_openai import ChatOpenAI
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from langchain.schema import AIMessage, HumanMessage

# %%
# Load environment variables
load_dotenv()
for key, value in os.environ.items():
    globals()[key] = value

# %%
# Initialize LLM
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)


# Create multiply tool
def multiply(a: int, b: int) -> int:
    """Simple multiplication function for LLM tool use."""
    return a * b


# Bind tool to LLM
llm_with_tools = llm.bind_tools([multiply])


# %%
class State(MessagesState):
    """State class inheriting from MessagesState for graph processing."""

    messages: Annotated[list[AnyMessage], add_messages] = Field(
        [], description="List of messages"
    )


# %%
def tool_calling_llm(state: MessagesState) -> MessagesState:
    """Node function that processes messages through LLM with tools."""
    state.messages = llm_with_tools.invoke(state.messages)
    return state


# %%
def build_graph() -> StateGraph:
    """Builds and returns the compiled state graph."""
    builder = StateGraph(State)
    builder.add_node("tool_calling_llm", tool_calling_llm)
    builder.add_edge(START, "tool_calling_llm")
    builder.add_edge("tool_calling_llm", END)
    return builder.compile()


# %%
def save_graph_visualization(graph: StateGraph, filename: str = "graph.png") -> None:
    """Saves graph visualization as PNG."""
    with open(filename, "wb") as f:
        f.write(graph.get_graph().draw_mermaid_png())


# %%
# Initialize graph
graph = build_graph()
save_graph_visualization(graph)

# Example usage
initial_messages = [
    AIMessage(content="Hello, how can I help you?", name="Model"),
    HumanMessage(content="What is 2 multiplied by 3?", name="User"),
]

result = graph.invoke({"messages": initial_messages})
for message in result.get("messages", []):
    message.pretty_print()
