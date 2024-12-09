# UV Package Manager Commands

## Overview

`uv` is an extremely fast Python package manager designed to simplify dependency management and project setup. After installing `uv`, you can verify its availability by running:

```bash
uv
```

You should see a help menu listing the available commands.

---

## Initial Setup

1. **Initialize the Project**:

   ```bash
   uv init
   ```

2. **Synchronize Dependencies**:

   ```bash
   uv sync
   ```

3. **Activate the Virtual Environment**:
   ```bash
   source .venv/bin/activate
   ```

---

## Installing Dependencies

### If You Already Have an Existing `requirements.txt`

To add all packages listed in `requirements.txt` to your project:

```bash
xargs uv add < requirements.txt
```

### Adding Single Packages

To add one or more packages:

```bash
uv add package_name
uv add package_name_1 package_name_2
```

### Adding Development Dependencies

To add a package as a development dependency:

```bash
uv add --dev package_name
```

---

## Running Langgraph

```bash
uv run langgraph dev --host localhost --port 8000
```

---

## Running Tests

To run your tests using pytest:

```bash
uv run pytest
```

---

## Check Python Version

To check the Python version in your virtual environment:

```bash
uv run python --version
```

---

## Locking Dependencies

To create or update the lock file for your dependencies:

```bash
uv lock
```

---

## Running Packages

To run a specific package with arguments:

```bash
uv run package_name args
```

---

## Formatting Code

To format your code using Ruff:

```bash
uvx ruff format .
```

---

## Additional Information

### Features of `uv`

- **Speed**: Designed for performance, making it faster than traditional package managers.
- **Simplicity**: Easy to use commands for managing packages and environments.
- **Integration**: Works seamlessly with existing Python projects and tools.

### Getting Help

If you encounter issues or need assistance, you can access help directly through the command line by running:

```bash
uv --help
```

This command will provide you with detailed information on available commands and options.

### Next Steps

Explore more features of `uv`, learn about advanced usage, or dive into specific guides to enhance your workflow.

For more detailed documentation, visit the official [UV Documentation](https://docs.astral.sh/uv/getting-started/first-steps/).
