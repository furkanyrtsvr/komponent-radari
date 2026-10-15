"""Select a version from the source version and existing vMAJOR.MINOR.PATCH tags."""
import json
import os
from pathlib import Path
import re
import subprocess

def parse(value):
    match = re.fullmatch(r'v?(\d+)\.(\d+)\.(\d+)', value.strip())
    return tuple(map(int, match.groups())) if match else None

def choose(requested, tags):
    versions = [v for tag in tags if (v := parse(tag)) is not None]
    latest = max(versions, default=None)
    if latest is None or requested > latest:
        return requested
    return latest[0], latest[1], latest[2] + 1

def main():
    package = Path('package.json')
    current = json.loads(package.read_text())['version'] if package.exists() else Path('VERSION').read_text().strip()
    requested = parse(current)
    if requested is None:
        raise SystemExit(f'Expected MAJOR.MINOR.PATCH, got {current!r}')
    tags = subprocess.check_output(['git', 'tag', '--list'], text=True).splitlines()
    version = '.'.join(map(str, choose(requested, tags)))
    if package.exists():
        subprocess.run(['npm', 'version', version, '--no-git-tag-version', '--allow-same-version', '--ignore-scripts'], check=True)
    else:
        Path('VERSION').write_text(version + '\n')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write(f'tag=v{version}\n')
    print(f'Release version: v{version}')

if __name__ == '__main__':
    main()
