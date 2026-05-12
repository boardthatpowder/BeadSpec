# VHS tape — BeadSpec quick-start demo
# Requires: vhs (https://github.com/charmbracelet/vhs)
# Usage: vhs scripts/vhs/quick-start.tape
# Output: docs-site/public/screenshots/quick-start.gif

Output docs-site/public/screenshots/quick-start.gif

Set Shell "bash"
Set FontSize 14
Set Width 900
Set Height 500
Set Theme "Dracula"

Type "# Initialize a Beads project"
Sleep 500ms
Type "mkdir my-project && cd my-project"
Enter
Sleep 500ms

Type "bd init"
Enter
Sleep 2s

Type "bd create --title='Fix the login button' --priority=1"
Enter
Sleep 1s

Type "bd list"
Enter
Sleep 1s

Type "# Now open the project in BeadSpec to see it visually"
Sleep 500ms
