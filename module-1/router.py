# %%
from dotenv import load_dotenv
from IPython.display import Image, display
from langgraph.graph import StateGraph, START, END
from langgraph.graph import MessagesState
from langgraph.prebuilt import ToolNode
from langgraph.prebuilt import tools_condition
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

load_dotenv()
# %%
def multiply(a: int, b: int) -> int:
    """Multiply a and b.

    Args:
        a: first int
        b: second int
    """
    return a * b

def calculate_sympy(expression: str) -> int:
    """Calculate a mathematical expression using sympy.
    Only supports numeric expressions.
    Only use for more complex calculations.

    Args:
        expression: mathematical expression as a string
    """
    from sympy import sympify
    from sympy import N

    # Convert the string expression to a sympy expression
    expr = sympify(expression)

    # Evaluate the expression numerically
    result = N(expr)

    return float(result)

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite-preview-06-17")
llm_with_tools = llm.bind_tools([multiply, calculate_sympy])
# %%
# Node
def tool_calling_llm(state: MessagesState):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


# Build graph
builder = StateGraph(MessagesState)
builder.add_node("tool_calling_llm", tool_calling_llm)
builder.add_node("tools", ToolNode([multiply, calculate_sympy]))
builder.add_edge(START, "tool_calling_llm")
builder.add_conditional_edges(
    "tool_calling_llm",
    # If the latest message (result) from assistant is a tool call -> tools_condition routes to tools
    # If the latest message (result) from assistant is a not a tool call -> tools_condition routes to END
    tools_condition,
)
builder.add_edge("tools", END)
graph = builder.compile()

# View
display(Image(graph.get_graph().draw_mermaid_png()))
# %%
messages = [
    HumanMessage(
        content="What is 2 multiplied by 3 divided by 3.5 multiplied by 4 square multiplied by square root of 2")
]
messages = graph.invoke({"messages": messages})
for m in messages["messages"]:
    m.pretty_print()
# %%
