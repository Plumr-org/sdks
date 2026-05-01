"""Minimal streaming example.

    PLUMR_API_KEY=plm_live_... python examples/basic.py "your prompt"
"""

import os
import sys

from plumr import Plumr


def main() -> None:
    api_key = os.environ.get("PLUMR_API_KEY")
    if not api_key:
        sys.exit("Set PLUMR_API_KEY first.")

    prompt = " ".join(sys.argv[1:]) or "Write a haiku about Mars."

    with Plumr(api_key=api_key) as client:
        for event in client.run(input=prompt):
            if event.type == "llm.delta":
                print(event.text, end="", flush=True)
            elif event.type == "run.end":
                print()
                print(
                    f"done · {event.durationMs}ms · {event.status}",
                    file=sys.stderr,
                )
                if event.error:
                    print(f"error: {event.error}", file=sys.stderr)


if __name__ == "__main__":
    main()
