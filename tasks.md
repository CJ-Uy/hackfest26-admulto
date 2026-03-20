Backend Issues:

- Even if the topic is valid and has papers about it, it always returns:
```
S2 rate limited (429), attempt 1/3
S2 retry attempt 1, waiting 5000ms...
S2 rate limited (429), attempt 2/3
S2 retry attempt 2, waiting 15000ms...
S2 rate limited (429), attempt 3/3
S2 rate limit exhausted, will supplement with web search
Only 0 S2 results, supplementing with web search
```
- Can output papers not in english
- Hallucinates papers that don't exist
- Takes too long to return results, even for simple queries

Tasks:
- Improve prompts and responses
- Add route to hit for polling to update the feed

Possible Backend Solutions:
- First fetch a few posts, around 5
- For the next couple of minutes, fetch more posts in the background and update the feed as they come in