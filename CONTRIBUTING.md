# Contributing to CareRoute AI

First off, thanks for taking the time to contribute! \U0001f389

The following is a set of guidelines for contributing to CareRoute AI. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## \U0001f6e0\ufe0f Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/careroute.git
    cd careroute
    ```
3.  **Install dependencies** using Bun:
    ```bash
    bun install
    ```
4.  **Create a branch** for your feature or bugfix:
    ```bash
    git checkout -b feature/amazing-feature
    # or
    git checkout -b fix/annoying-bug
    ```

## \U0001f4bb Development Workflow

*   **Runtime**: We use [Bun](https://bun.sh) for everything (installing packages, running scripts).
*   **Styling**: We use [Tailwind CSS](https://tailwindcss.com). Please avoid writing custom CSS in `globals.css` unless absolutely necessary; use utility classes.
*   **Icons**: Use `lucide-react` for icons.

### Running Locally
```bash
bun dev
```
Open [http://localhost:3000](http://localhost:3000).

## \U0001f4dd Commit Convention

We follow a rough "Conventional Commits" style to keep history readable:

*   `feat: add new dashboard widget`
*   `fix: resolve login redirect issue`
*   `docs: update readme instructions`
*   `style: formatting changes only`
*   `refactor: cleanup auth logic`

## \U0001f4ea Submitting a Pull Request

1.  **Push your branch** to GitHub:
    ```bash
    git push origin feature/amazing-feature
    ```
2.  **Open a Pull Request** against the `main` branch of the original repository.
3.  **Describe your changes**: What did you do? Why? Screenshots are awesome if you changed the UI!

## \U0001f9e9 Project Structure

*   `src/app`: Next.js App router pages.
*   `src/components`: Reusable UI components.
*   `src/lib`: Utility functions and business logic (e.g., `rules.ts`).

Happy Coding! \U0001f680
