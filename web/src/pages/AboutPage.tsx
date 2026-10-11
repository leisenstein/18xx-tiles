import { Info } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

// About and credits (/about, DESIGN.md open item 1): where the data comes from, the game-titles disclaimer, and the fonts and libraries the site uses.
// The full license texts are in THIRD-PARTY-NOTICES.md in the repository.

const LIBRARIES = [
  { name: 'React and React Router', license: 'MIT', url: 'https://react.dev' },
  { name: 'Radix UI and shadcn/ui', license: 'MIT', url: 'https://ui.shadcn.com' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://tailwindcss.com' },
  { name: 'Lucide icons', license: 'ISC', url: 'https://lucide.dev' },
  { name: 'pdf-lib and fontkit', license: 'MIT', url: 'https://pdf-lib.js.org' },
  { name: 'ASP.NET Core and Entity Framework Core', license: 'MIT', url: 'https://dotnet.microsoft.com' },
  { name: 'Dapper', license: 'Apache-2.0', url: 'https://github.com/DapperLib/Dapper' },
  { name: 'DbUp', license: 'MIT', url: 'https://dbup.readthedocs.io' },
  { name: 'SQLite', license: 'public domain', url: 'https://sqlite.org' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

export default function AboutPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader icon={Info} title="About and credits" description="Where the tiles come from, and the work this site is built on." />

      <Section title="Tile data">
        <p>
          The games, tile definitions, tile counts, designers, and publishers come from{' '}
          <a href="https://github.com/tobymao/18xx" className="underline">
            tobymao/18xx
          </a>
          , the open-source code behind{' '}
          <a href="https://18xx.games" className="underline">
            18xx.games
          </a>
          , used under the MIT License (Copyright (c) 2021 Tobias Mao). Thank you to its authors and contributors. Counts come from 18xx.games manifests and may
          not match every printing of a game.
        </p>
        <p>The tile drawings, printable number circles, and logo are drawn by this site, not copied from 18xx.games.</p>
      </Section>

      <Section title="Game titles">
        <p>
          Game titles belong to their designers and publishers. As the tobymao/18xx license notes, its MIT License does not cover any rights in the game titles.
          This site shows titles, designers, and publishers only to identify which game a tile belongs to.
        </p>
        <p>This site is not affiliated with, or endorsed by, 18xx.games, its authors, or any game designer or publisher.</p>
      </Section>

      <Section title="Fonts">
        <p>Geist (the site&apos;s text) and Roboto Condensed (numbers on printable circles), both under the SIL Open Font License 1.1.</p>
      </Section>

      <Section title="Software">
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {LIBRARIES.map((lib) => (
            <li key={lib.name}>
              <a href={lib.url} className="underline">
                {lib.name}
              </a>{' '}
              <span className="text-muted-foreground">· {lib.license}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">The full license texts are in THIRD-PARTY-NOTICES.md in the project&apos;s source.</p>
      </Section>
    </div>
  )
}
