# %%
import os
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
from langchain.schema import SystemMessage

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
        content="""You are a helpful assistant specialized in performing arithmetic operations. 
        When presented with a mathematical expression, break it down into smaller, manageable parts before using the calculate tool function. 
        The calculator can only handle one operation at a time, so perform each step sequentially. 
        For example, handle multiplication first, then use the result for addition or subtraction, and so on. 
        Ensure clarity and accuracy in your calculations."""
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
    state.messages = llm_with_tools.invoke(state.messages)
    return state


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

    return builder.compile()


# %%
# Initialize environment and LLM
load_environment()
llm_with_tools = setup_llm()

# Build and save graph
graph = build_graph()
