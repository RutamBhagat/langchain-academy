# %%
from dotenv import load_dotenv
from typing import Annotated
from typing_extensions import TypedDict
from IPython.display import Image, display
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START, END

load_dotenv()
# %%
messages = [
    AIMessage(content="So you said you were researching ocean mammals?", name="Model")
]
messages.append(HumanMessage(content="Yes, that's right.", name="Lance"))
messages.append(
    AIMessage(content="Great, what would you like to learn about.", name="Model")
)
messages.append(
    HumanMessage(
        content="I want to learn about the best place to see Orcas in the US.",
        name="Lance",
    )
)

for m in messages:
    m.pretty_print()

# %%

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite-preview-06-17")
result = llm.invoke(messages)
type(result)
# %%
result.pretty_print()
# %%
result.response_metadata
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
    
    return int(result)


llm_with_tools = llm.bind_tools([multiply, calculate_sympy])
# %%
tool_call = llm_with_tools.invoke(
    [HumanMessage(content="What is 2 multiplied by 3", name="Lance")]
)
# %%
tool_call.tool_calls
# %%
tool_call = llm_with_tools.invoke(
    [HumanMessage(content="What is 2 multiplied by 3 divided by 3.5 multiplied by 4 square multiplied by square root of 2", name="Lance")]
)
# %%
tool_call.tool_calls

# %%
class MessagesState(TypedDict):
    messages: list[AnyMessage]
# %%
class MessagesState(TypedDict):  # noqa: F811
    messages: Annotated[list[AnyMessage], add_messages]
# %%
# Using pre-built MessagesState from langgraph.graph
from langgraph.graph import MessagesState  # noqa: E402, F811

class MessagesState(MessagesState):
    # Add any keys needed beyond messages, which is pre-built
    pass
# %%
# Initial state
initial_messages = [
    AIMessage(content="Hello! How can I assist you?", name="Model"),
    HumanMessage(
        content="I'm looking for information on marine biology.", name="Lance"
    ),
]

# New message to add
new_message = AIMessage(
    content="Sure, I can help with that. What specifically are you interested in?",
    name="Model",
)

# Test
add_messages(initial_messages, new_message)
# %%
# Node
def tool_calling_llm(state: MessagesState) -> MessagesState:
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


# Build graph
builder = StateGraph(MessagesState)
builder.add_node("tool_calling_llm", tool_calling_llm)
builder.add_edge(START, "tool_calling_llm")
builder.add_edge("tool_calling_llm", END)
graph = builder.compile()

# View
display(Image(graph.get_graph().draw_mermaid_png()))
# %%
messages = graph.invoke({"messages": HumanMessage(content="Hello!")})
for m in messages["messages"]:
    m.pretty_print()
# %%
messages = graph.invoke({"messages": HumanMessage(content="Multiply 2 and 3")})
for m in messages["messages"]:
    m.pretty_print()
# %%
