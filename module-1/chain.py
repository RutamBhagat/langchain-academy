# %%

import os
import json
from pprint import pprint
from typing import Annotated
from dotenv import load_dotenv
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
print(
    json.dumps(tool_call.additional_kwargs.get("tool_calls", []), indent=2).replace(
        "\\", ""
    )
)


# %%
class MessagesState(BaseModel):
    messages: Annotated[list[AnyMessage], add_messages] = Field(
        [], description="List of messages"
    )