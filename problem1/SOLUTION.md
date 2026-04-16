# Problem 1
CLI command:

```bash
jq -r 'select(.symbol == "TSLA" and .side == "sell") | .order_id' ./transaction-log.txt | xargs -r -I{} curl -fsS "https://example.com/api/{}" >> ./output.txt
```

Why I chose this:

- keeps it as a single CLI command
- `jq` makes the filter easier to read
- filters only sell orders for `TSLA`
- extracts the `order_id`
- sends one HTTP GET request per matching order
- appends responses into the output file

From the provided file, the matching order IDs are:

- `12346`
- `12362`
