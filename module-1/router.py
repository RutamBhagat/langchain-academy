# %%
import os
from typing import Annotated
from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from langchain.schema import HumanMessage
import sympy


# %%
def load_environment() -> None:
    """Load environment variables into global namespace."""
    load_dotenv()
    for key, value in os.environ.items():
        globals()[key] = value


# %%
def calculate(expression: str) -> float:
    """
    Safely evaluate a mathematical expression using sympy.

    Args:
        expression: A string containing a mathematical expression (e.g., "2*3+2")

    Returns:
        Result of evaluating the expression
    """
    try:
        result = sympy.sympify(expression)
        return float(result.evalf())
    except (sympy.SympifyError, ValueError) as e:
        return f"Error: Invalid expression - {str(e)}"


# %%
class MessagesState(BaseModel):
    """State class for managing message flow in the graph."""

    messages: Annotated[list[AnyMessage], add_messages] = Field(
        default_factory=list, description="List of messages in the conversation"
    )


# %%
def setup_llm() -> ChatOpenAI:
    """Initialize and configure LLM with tools."""
    llm = ChatOpenAI(model=os.getenv("OPENAI_MODEL"))
    return llm.bind_tools([calculate])


# %%
def tool_calling_llm(state: MessagesState) -> MessagesState:
    """Process messages through LLM with tool support."""
    state.messages = llm_with_tools.invoke(state.messages)
    return state


# %%
def build_graph() -> StateGraph:
    """Construct and compile the message processing graph."""
    builder = StateGraph(MessagesState)

    # Add nodes
    builder.add_node("tool_calling_llm", tool_calling_llm)
    builder.add_node("tools", ToolNode([calculate]))

    # Add edges
    builder.add_edge(START, "tool_calling_llm")
    builder.add_conditional_edges("tool_calling_llm", tools_condition)
    builder.add_edge("tools", END)

    return builder.compile()


# %%
def save_graph_visualization(graph: StateGraph, filename: str = "graph.png") -> None:
    """Save graph visualization to file."""
    with open(filename, "wb") as f:
        f.write(graph.get_graph().draw_mermaid_png())


# %%
# Initialize environment and LLM
load_environment()
llm_with_tools = setup_llm()

# Build and save graph
graph = build_graph()
save_graph_visualization(graph)

# Example usage
messages = [HumanMessage(content="What is 2 times 3?")]
result = graph.invoke({"messages": messages})

# Print results
for message in result.get("messages", []):
    message.pretty_print()

# %%
