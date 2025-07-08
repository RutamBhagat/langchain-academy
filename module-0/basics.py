# %%
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_tavily import TavilySearch

load_dotenv()
# %%
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
# %%

messages = [
    SystemMessage(content="You are a pirate who loves to talk in pirate slang."),
    HumanMessage(content="Are you the famous captain Jack Sparrow?"),
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
