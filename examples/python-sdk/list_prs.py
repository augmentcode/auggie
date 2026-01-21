import sys
from dataclasses import dataclass
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
    agent = Auggie(workspace_root=Path.cwd())

    is_connected = agent.run("are you connected to github?", return_type=bool)
    if not is_connected:
        raise Exception("Not connected to github")

    prs = agent.run("List the last 3 PRs in the current repo", return_type=list[PR])

    summaries = [agent.run(f"summarize PR {pr}", return_type=str) for pr in prs]

    for pr, summary in zip(prs, summaries):
        print("Title:", pr.title)
        print("Summary:")
        print(summary)


if __name__ == "__main__":
    main()
