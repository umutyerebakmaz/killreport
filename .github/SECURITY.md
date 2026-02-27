# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of KillReport seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do not:

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed
- Test the vulnerability on production systems or user data

### Please do:

- Report security vulnerabilities via GitHub's private vulnerability reporting feature
- Or email security details to: [INSERT SECURITY EMAIL]
- Provide detailed information about the vulnerability
- Give us reasonable time to respond before disclosing publicly

### What to include in your report:

- Type of vulnerability (e.g., SQL injection, XSS, CSRF, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## What to Expect

### Response Timeline

- **Initial Response**: We aim to acknowledge receipt of your vulnerability report within 48 hours
- **Status Update**: We will send you regular updates about our progress, at least every 5 business days
- **Resolution**: We aim to resolve critical issues within 90 days of initial report

### What happens next:

1. **Confirmation**: We will confirm the vulnerability and determine its impact
2. **Patch Development**: We will work on a patch to fix the vulnerability
3. **Testing**: The patch will be thoroughly tested
4. **Release**: We will release the security patch
5. **Disclosure**: After the patch is released, we will publicly disclose the vulnerability with credit to the reporter (if desired)

## Security Best Practices for Contributors

If you're contributing to KillReport, please follow these security guidelines:

### Authentication & Authorization

- Never commit API keys, passwords, or other sensitive credentials
- Use environment variables for all sensitive configuration
- Implement proper authentication checks for all protected routes
- Validate user permissions before performing actions
- Use secure session management

### Input Validation

- Validate and sanitize all user inputs
- Use parameterized queries to prevent SQL injection
- Implement proper CSRF protection
- Validate file uploads (type, size, content)
- Use proper encoding when rendering user content

### Data Protection

- Encrypt sensitive data at rest and in transit
- Use HTTPS for all connections
- Implement rate limiting to prevent abuse
- Follow the principle of least privilege
- Don't log sensitive information

### Dependencies

- Keep all dependencies up to date
- Review security advisories for dependencies
- Use tools like `npm audit` or `yarn audit` regularly
- Remove unused dependencies

### Code Review

- All code must be reviewed before merging
- Security-sensitive changes require extra scrutiny
- Look for common vulnerabilities (OWASP Top 10)
- Test for edge cases and error conditions

## Known Security Considerations

### EVE Online SSO

- All authentication flows use EVE Online's official SSO
- OAuth tokens are stored securely and refreshed automatically
- Access tokens are short-lived and rotated regularly

### API Security

- GraphQL queries are validated and rate-limited
- Authentication required for all user-specific operations
- DataLoader prevents N+1 query vulnerabilities

### Database Security

- All queries use Prisma ORM with parameterization
- Database connection uses SSL/TLS
- Regular backups are performed and encrypted

## Security Updates

Security updates will be released as needed and announced via:

- GitHub Security Advisories
- GitHub Releases
- Project README

## Disclosure Policy

We follow a coordinated disclosure policy:

1. Security issues are fixed privately
2. A release containing the fix is prepared
3. The vulnerability is disclosed publicly after the fix is released
4. Credit is given to the reporter (if desired)

## Bug Bounty Program

We currently do not have a bug bounty program. However, we deeply appreciate security researchers who responsibly disclose vulnerabilities and will acknowledge your contribution in our security advisories.

## Contact

For security-related questions or concerns that are not vulnerability reports, please open a discussion on GitHub or contact the maintainers.

## Compliance

KillReport follows industry-standard security practices including:

- OWASP Top 10 security guidelines
- CWE/SANS Top 25 most dangerous software errors
- Secure coding standards

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [EVE Online Third-Party Developer Guidelines](https://developers.eveonline.com/)

---

Thank you for helping keep KillReport and its users safe!
