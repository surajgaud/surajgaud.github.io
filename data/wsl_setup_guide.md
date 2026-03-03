# WSL Setup Guide

A comprehensive guide to setting up a development environment on Windows Subsystem for Linux.

## Prerequisites

- Windows 10 (version 2004+) or Windows 11
- Administrator access

## Install WSL

Open PowerShell as Administrator and run:

```powershell
wsl --install
```

This installs WSL 2 with Ubuntu by default. Restart your machine when prompted.

## Initial Configuration

After reboot, Ubuntu will launch and prompt you to create a UNIX username and password.

Update packages:

```bash
sudo apt update && sudo apt upgrade -y
```

## Essential Tools

### Git

```bash
sudo apt install git -y
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Node.js (via nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
```

### Python

```bash
sudo apt install python3 python3-pip python3-venv -y
```

### Docker

Install Docker Desktop for Windows and enable the WSL 2 backend in Settings > General > "Use the WSL 2 based engine".

## Terminal Setup

Install [Windows Terminal](https://aka.ms/terminal) from the Microsoft Store for the best experience. It auto-detects your WSL distributions.

## VS Code Integration

Install the **Remote - WSL** extension in VS Code. Then open any WSL directory with:

```bash
code .
```

## File System Tips

- Keep your project files inside the WSL file system (`~/projects/`) for best performance
- Access Windows files from WSL at `/mnt/c/`
- Access WSL files from Windows at `\\wsl$\Ubuntu\`

## SSH Keys

```bash
ssh-keygen -t ed25519 -C "your.email@example.com"
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Copy the output and add it to your GitHub/GitLab account.

## Conclusion

With this setup you have a fully functional Linux development environment running seamlessly alongside Windows. Customize further based on your stack and workflow.
