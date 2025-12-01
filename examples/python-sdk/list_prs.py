import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

# Add the parent directory to the path so we can import auggie_sdk
sys.path.insert(0, str(Path(__file__).parent.parent))


from auggie_sdk import Auggie


@dataclass
class PR:
    title: str
    number: int
    url: str
    author: str


def main():
    a = Agent(workspace_root=Path.cwd())

    if not a(bool) @ "are you connected to github?":
        raise Exception("Not connected to github")

    prs = a(list[PR]) @ "List the last 3 PRs in the current repo"

    summaries = [a(str) @ f"summarize PR {pr}" for pr in prs]

    for pr, summary in zip(prs, summaries):
        print("Title:", pr.title)
        print("Summary:")
        print(summary)


if __name__ == "__main__":
    main()
