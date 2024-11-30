# %%
import os
from dotenv import load_dotenv
from langchain.schema import HumanMessage
from langchain_community.tools import TavilySearchResults
from langchain_openai import ChatOpenAI

# %%
load_dotenv()

# Import all environment variables into the current namespace
for key, value in os.environ.items():
    globals()[key] = value

# %%

gpt4o_chat = ChatOpenAI(model="gpt-4o-mini", temperature=0)
gpt35_chat = ChatOpenAI(model="gpt-3.5-turbo-0125", temperature=0)

# %%

msg = HumanMessage(content="Hello, how are you?", name="Rutam")
messages = [msg]
gpt4o_chat.invoke(messages)

# %%
gpt4o_chat.invoke("Who is the coolest president of USA")
# %%
gpt35_chat.invoke("Why do people say Trump is an orange")
# %%

tavily_search = TavilySearchResults(max_results=3)
search_docs = tavily_search.invoke("Who won the 2024 presidential election in USA")
# %%
search_docs
# %%
