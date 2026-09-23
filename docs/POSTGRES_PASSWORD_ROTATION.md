# PostgreSQL Password Rotation Procedure

This document describes the manual procedure for rotating the PostgreSQL `postgres` database user password for the **Transport Accounting System**.

> [!IMPORTANT]
> To preserve credential security, perform this procedure directly in your terminal. Never enter or log plain-text production credentials into automated tool environments.

---

## Step 1: Connect to PostgreSQL

Open a PowerShell or Command Prompt terminal and run `psql` interactively:

```powershell
& "D:\PG16_Transport\bin\psql.exe" -U postgres -d transport_acc
```

When prompted, enter your current password.

---

## Step 2: Rotate User Password

At the `transport_acc=#` SQL prompt, run the interactive password command:

```sql
\password postgres
```

PostgreSQL will prompt you to enter and confirm your new password privately:
1. `Enter new password:` (type your new secure password)
2. `Enter it again:` (re-type to confirm)

Then exit `psql`:

```sql
\q
```

---

## Step 3: Update `.env.local`

Open your local environment configuration file: `transport-app/.env.local`

Update the `DATABASE_URL` entry:

```env
DATABASE_URL=postgresql://postgres:<YOUR_NEW_PASSWORD>@localhost:5432/transport_acc
```

### URL Encoding Rules for Special Characters

If your new password contains special characters, you **must** URL-encode them in the `DATABASE_URL` string so the PostgreSQL driver parses credentials correctly:

| Character | URL Encoded Equivalent |
| :---: | :---: |
| `@` | `%40` |
| `#` | `%23` |
| `%` | `%25` |
| `:` | `%3A` |
| `/` | `%2F` |
| `?` | `%3F` |

*Example format (conceptual):*
If your password is `MySecret@2026`, write:
`DATABASE_URL=postgresql://postgres:MySecret%402026@localhost:5432/transport_acc`

---

## Step 4: Verify Connection

Verify that the application can connect using the updated `.env.local`:

```powershell
npm run db:migrate
```

Expected output:
`[✓] migrations applied successfully!`
