# Contributing to Bunganutz

Thank you for your interest in contributing to the Bunganutz cottage planning app! This document provides guidelines and information for contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Install dependencies**: `npm install`
4. **Set up environment variables** (see README.md)
5. **Start the development server**: `npm start`

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow the existing code style and formatting
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Git Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "Add descriptive commit message"
   ```

3. Push your branch and create a Pull Request:
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Messages

Use clear, descriptive commit messages:
- Start with a verb (Add, Fix, Update, Remove, etc.)
- Keep the first line under 50 characters
- Use the imperative mood ("Add feature" not "Added feature")

Examples:
- `Add meal attendance tracking for day guests`
- `Fix TypeScript error in MealPicker component`
- `Update README with database setup instructions`

## Testing

- Test your changes thoroughly before submitting
- Ensure the app builds without errors: `npm run build`
- Test on different browsers if applicable
- Verify that existing functionality still works

## Pull Request Process

1. **Update documentation** if your changes affect user-facing features
2. **Add tests** for new functionality (if applicable)
3. **Ensure all tests pass** before submitting
4. **Describe your changes** clearly in the PR description
5. **Reference any related issues** using GitHub's linking syntax

## Reporting Issues

When reporting bugs or requesting features:

1. **Search existing issues** to avoid duplicates
2. **Use the issue templates** if available
3. **Provide clear steps** to reproduce the problem
4. **Include relevant information** (browser, OS, error messages)
5. **Add screenshots** if applicable

## Feature Requests

When suggesting new features:

1. **Explain the problem** you're trying to solve
2. **Describe your proposed solution**
3. **Consider the impact** on existing functionality
4. **Think about edge cases** and user experience

## Code Review

All contributions require review before merging:

- **Be responsive** to review comments
- **Make requested changes** promptly
- **Ask questions** if something is unclear
- **Be respectful** and constructive in feedback

## Getting Help

If you need help with your contribution:

1. **Check the documentation** in the README and database folders
2. **Search existing issues** for similar problems
3. **Ask questions** in your Pull Request
4. **Open a discussion** for general questions

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to Bunganutz! 🏡 