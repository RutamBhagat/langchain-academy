# %%

import os
import json
from pprint import pprint
from typing import Annotated
from dotenv import load_dotenv
from langgraph.graph import END, START, MessagesState, StateGraph
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from langchain.schema import AIMessage, HumanMessage

# %%

load_dotenv()

# Import all environment variables into the current namespace
for key, value in os.environ.items():
    globals()[key] = value

# %%

messages = [
    AIMessage(content=f"So you said you were researching ocean mammals?", name="Model")
]
messages.extend([HumanMessage(content="yes thats right", name="Rutam")])
messages.extend(
    [AIMessage(content="What kind of ocean mammals are you researching?", name="Model")]
)
messages.extend([HumanMessage(content="I am researching dolphins", name="Rutam")])

# %%

for message in messages:
    # pprint(message)
    message.pretty_print()

# %%
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
result = llm.invoke(messages)
type(result)
# %%
pprint(result)
# %%
print(result.content)
# %%
print(json.dumps(result.response_metadata, indent=2))


# %%
def multiply(a: int, b: int) -> int:
    return a * b


llm_with_tools = llm.bind_tools([multiply])
# %%
tool_call = llm_with_tools.invoke(
    [HumanMessage(content="multiply 3 and 4", name="Rutam")]
)
# %%
tool_call
# %%
# print(
#     json.dumps(tool_call.additional_kwargs.get("tool_calls", []), indent=2).replace(
#         "\\", ""
#     )
# )
tool_call.pretty_print()


# %%
class MessagesState(BaseModel):
    messages: Annotated[list[AnyMessage], add_messages] = Field(
        [], description="List of messages"
    )


# %%

# Initial state
initial_messages = [
    AIMessage(content="Hello, how can I help you?", name="Model"),
    HumanMessage(
        content="I am looking for information on Arcan divine forbidden magic and dark arts",
        name="Rutam",
    ),
]

new_message = AIMessage(
    content="Sure I can help you with that. What specifically are you interested in?",
    name="Model",
)

add_messages(initial_messages, new_message)


# %%
class State(MessagesState):
    # messages key is prebuilt in MessagesState with add_messages annotation
    # add any additional keys here
    pass


# %%
# Node
def tool_calling_llm(state: MessagesState):
    state.messages = llm_with_tools.invoke(state.messages)
    return state


# %%
# Build Graph
builder = StateGraph(State)

# Add nodes
builder.add_node("tool_calling_llm", tool_calling_llm)

# Add edges
builder.add_edge(START, "tool_calling_llm")
builder.add_edge("tool_calling_llm", END)

# compile graph
graph = builder.compile()

# %%
# Get the graph in PNG format
graph_png = graph.get_graph().draw_mermaid_png()

# Save the PNG to a file in the current directory
with open("graph.png", "wb") as f:
    f.write(graph_png)

# %%

messages = graph.invoke({"messages": initial_messages})

# %%
print(messages.get("messages", [])[-1].content)
# %%
messages = graph.invoke(
    {"messages": HumanMessage(content="What is 10 multiplied by 20")}
)
# %%
messages
# %%
for message in messages.get("messages", []):
    message.pretty_print()
# %%
