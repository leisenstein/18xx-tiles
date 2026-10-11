# Third-party notices

The 18xx Tiles app includes or is built from the work below. Each part keeps its own license. Our own code (the tile renderer, number circles,
logo, and the rest of this repository) is not covered by these notices.

## Tile data: tobymao/18xx (18xx.games)

The games, tile definitions, tile counts, and designer and publisher names are read from the source of
[tobymao/18xx](https://github.com/tobymao/18xx) by `tools/import/update_data.py`, at the commit pinned in `tools/import/18xx-commit.txt`.
None of their code is included. Their license, unchanged:

```
PLEASE NOTE:
The MIT License applies to the Software implementing the game platform on the website 18xx.Games.
All specific game titles appearing within the Software are published on such website
with permission from their respective designers and/or publishers.
The MIT License does not apply to any rights associated with such game titles.

MIT License

Copyright (c) 2021 Tobias Mao

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

As that notice says, the MIT License does not cover any rights in the game titles. This site shows game titles, designers, and publishers only to
identify which game a tile belongs to, and is not affiliated with 18xx.games, its authors, or any designer or publisher.

## Game and tile list data: 18xx.net

Some games that 18xx.games does not have (older and unpublished designs, units, kits, and variants), their designer and publisher names, which
tiles they use, and how many, come from [18xx.net](http://www.18xx.net/) (Blackwater Station) and its Tile Encyclopaedia, by Chris Lawson,
John David Galt and contributors. Only these facts are used, gathered by `tools/import/18xxnet/compare_18xxnet.py` and kept in
`tools/import/18xxnet/18xxnet-games.json`; none of the site's text or images are included. The site states no license. Thank you to its authors.

## Fonts

| Font | Used for | License |
|---|---|---|
| Roboto Condensed Bold (`@fontsource/roboto-condensed`) | tile numbers on printable circles; the logo's wordmark (as outlines) | SIL Open Font License 1.1 |
| Geist (`@fontsource-variable/geist`) | the site's text | SIL Open Font License 1.1 |

Copyright 2011 Google Inc. All Rights Reserved. RobotoCondensed-Italic[wght].ttf: Copyright 2011 Google Inc. All Rights Reserved.

Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font) Geist-Italic[wght].ttf: Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font)

## Libraries shipped with the website and API

| Library | Version | License | Copyright |
|---|---|---|---|
| React, React DOM | 19.3.0 | MIT | Meta Platforms, Inc. and affiliates |
| React Router | 8.4.0 | MIT | React Training LLC, Remix Software |
| Radix UI | 1.7.0 | MIT | WorkOS |
| shadcn/ui components and `cn` | 0.4.0 | MIT | shadcn |
| class-variance-authority | 0.7.1 | Apache-2.0 | Joe Bell |
| Lucide icons (`lucide-react`) | 1.54.0 | ISC | Lucide Icons and Contributors |
| Tailwind CSS | 4.3.3 | MIT | Tailwind Labs, Inc. |
| tw-animate-css | 1.4.0 | MIT | Wombosvideo |
| pdf-lib | 1.17.1 | MIT | Andrew Dillon |
| `@pdf-lib/fontkit` (fork of fontkit by Devon Govett) | 1.1.1 | MIT | see the package |
| pako (used by pdf-lib) | 1.0.11 | MIT and Zlib | Vitaly Puzrin and Andrei Tuputcyn |
| tslib | 2.8.1 | 0BSD | Microsoft Corporation |
| ASP.NET Core Identity, Entity Framework Core, Microsoft.Data.Sqlite | 10.0.12 | MIT | Microsoft Corporation |
| Dapper | 2.1.89 | Apache-2.0 | 2019 Stack Exchange, Inc. |
| DbUp (`dbup-sqlite`, `dbup-core`) | 6.0.4 | MIT | DbUp Contributors 2015 |
| SQLite | bundled | public domain | |

Each package's full license text is in its own folder (`web/node_modules/<package>/LICENSE`, and the NuGet package cache for the API).

## SIL Open Font License 1.1 (both fonts)

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
