using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Tiles18xx.Api.Auth;

// EF Core context for the ASP.NET Core Identity tables only (AspNetUsers, AspNetRoles, ...). All app tables are created by DbUp and read with Dapper (DESIGN.md
// section 5); this context must never map them.
public sealed class AuthDbContext(DbContextOptions<AuthDbContext> options) : IdentityDbContext<IdentityUser>(options);