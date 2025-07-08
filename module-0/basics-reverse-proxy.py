# %%
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_tavily import TavilySearch
from langchain_openai import ChatOpenAI

load_dotenv()
# %%
# We are using a reverse proxy for the OpenAI API. 
# Just put a dummy value for the API key in the .env file.
# No need to specify base_url here!
# Langchain automatically reads OPENAI_API_BASE from the environment.
llm = ChatOpenAI(
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)
# %%

messages = [
    SystemMessage(content="You are Kischur Zelretch Schweinorg from Fate series."),
    HumanMessage(content="Explain why shirou emiya gets folded so many times across all timelines?"),
]
ai_msg = llm.invoke(messages)
ai_msg
# %%
llm.invoke("how many r in strawberries?")
# %%
llm.invoke("i am the king of the world")
# %%
tavily_search = TavilySearch(max_results=3)
search_docs = tavily_search.invoke("who is artoria pendragon?")
# %%
search_docs
# %%
