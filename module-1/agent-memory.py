# %%
import os
from langgraph_storage.checkpoint import MemorySaver
import sympy
import warnings
from typing import Annotated
from dotenv import load_dotenv
from langgraph.graph import START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from langchain.schema import HumanMessage, SystemMessage

warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")


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
        # Convert string expression to sympy expression and evaluate
        result = sympy.sympify(expression)
        return float(result.evalf())
    except (sympy.SympifyError, ValueError) as e:
        return f"Error: Invalid expression - {str(e)}"


# %%
"""State class for managing message flow in the graph."""


def get_default_messages() -> list[AnyMessage]:
    """Create default message list with system message."""
    sys_msg = SystemMessage(
        content="""You are a helpful assistant tasked with performing arithmetic on a set of inputs. 
        If there are any math operations break them down in smaller parts before using the calculate tool function, 
        the calculator is primitive and can not handle multiple BODMOS operations all at once do one operation at a time 
        for e.g. multiply in one step then based on the result add or substract etc.
        remember if there is any math based question then always use the calculate tool do not try to calculate on your own"""
    )
    return [sys_msg]


class MessagesState(BaseModel):
    messages: Annotated[list[AnyMessage], add_messages] = Field(
        default_factory=get_default_messages,
        description="List of messages in the conversation",
    )


# %%
def setup_llm() -> ChatOpenAI:
    """Initialize and configure LLM with tools."""
    llm = ChatOpenAI(model=os.getenv("OPENAI_MODEL"))
    llm_with_tools = llm.bind_tools([calculate], parallel_tool_calls=False)
    return llm_with_tools


# %%
def assistant(state: MessagesState) -> MessagesState:
    """Process messages through LLM with tool support."""
    return {"messages": llm_with_tools.invoke(state.messages)}


# %%
def build_graph() -> StateGraph:
    """Construct and compile the message processing graph."""
    builder = StateGraph(MessagesState)

    # Add nodes
    builder.add_node("assistant", assistant)
    builder.add_node("tools", ToolNode([calculate]))

    # Add edges
    builder.add_edge(START, "assistant")
    builder.add_conditional_edges("assistant", tools_condition)
    builder.add_edge("tools", "assistant")

    # Add memory
    memory = MemorySaver()
    return builder.compile(checkpointer=memory)


# %%
def save_graph_visualization(graph: StateGraph, filename: str = "graph.png") -> None:
    """Save graph visualization to file."""
    with open(filename, "wb") as f:
        f.write(graph.get_graph(xray=True).draw_mermaid_png())


# %%
# Initialize environment and LLM
load_environment()
llm_with_tools = setup_llm()

# Build and save graph
graph = build_graph()
save_graph_visualization(graph)

# Configuaration for the graph thread
config = {"configurable": {"thread_id": "1"}}

# %%
# Example usage
messages = [
    HumanMessage(
        content="""A company has a tiered bonus system for its employees. The bonus is calculated as follows:
        Tier 1: For sales between $10,000 and $20,000, employees earn a 5 percent bonus on the amount exceeding $10,000.
        Tier 2: For sales between $20,001 and $50,000, employees earn the Tier 1 bonus, plus 8 percent of the amount exceeding $20,000.
        Tier 3: For sales above $50,000, employees earn the Tier 1 and Tier 2 bonuses, plus 12 percent of the amount exceeding $50,000.
        Calculate the total bonus for an employee with sales of $65,750."""
    )
]
result = graph.invoke({"messages": messages}, config)

# Print results
for message in result.get("messages", []):
    message.pretty_print()

# %%
messages = [
    HumanMessage(
        content="""The employee's sales were initially miscalculated. Their actual sales were $72,300. 
        What is the difference in their bonus amount compared to the original calculation based on $65,750?"""
    )
]
result = graph.invoke({"messages": messages}, config)

# Print results
for message in result.get("messages", []):
    message.pretty_print()

# %%
