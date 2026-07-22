# Changelog

## [0.4.1](https://github.com/alanrsoares/mdreadr/compare/v0.4.0...v0.4.1) (2026-07-22)


### Bug Fixes

* **webview:** make drag-and-drop of markdown files work in packaged app ([cf4f93c](https://github.com/alanrsoares/mdreadr/commit/cf4f93c219d7c4dba74b072b83f45d61eaa8d393))
* **webview:** make drag-and-drop of markdown files work in packaged app ([356a34b](https://github.com/alanrsoares/mdreadr/commit/356a34b7d82bfa39d14c7e31f7824107eb249a25))

## [0.4.0](https://github.com/alanrsoares/mdreadr/compare/v0.3.0...v0.4.0) (2026-07-20)


### Features

* **api:** enrich journal events with entity summaries and latestSeq ([f7151cc](https://github.com/alanrsoares/mdreadr/commit/f7151ccbb6bd00f9f516dc95906594c64b86338b))
* **domain:** add listDocumentBlocks for anchor discovery ([39bedee](https://github.com/alanrsoares/mdreadr/commit/39bedeef461438ca9ecd0814e0db8f0a7a60ba65))
* HITL loop improvements for the MCP review API ([3456d45](https://github.com/alanrsoares/mdreadr/commit/3456d458702f18dc451b5b0da8ab2b919ddde221))
* **mcp:** add get_document_blocks and suggestion read tools ([f4fe5f3](https://github.com/alanrsoares/mdreadr/commit/f4fe5f307cd3c537190a4af213185b4bdb9cdbac))

## [0.3.0](https://github.com/alanrsoares/mdreadr/compare/v0.2.1...v0.3.0) (2026-07-19)


### Features

* improved mcp tooling + linux installer ([16f7f94](https://github.com/alanrsoares/mdreadr/commit/16f7f941fdb666aae5ea0b43e10872eb4a3285f3))
* linux installer ([6ccbdee](https://github.com/alanrsoares/mdreadr/commit/6ccbdeed4e4eef003b38cb3def1022acefc67eb0))
* **mcp:** show connected MCP clients in the app ([8c1ec04](https://github.com/alanrsoares/mdreadr/commit/8c1ec04ba6d61bc4930b9a4b64dd84192fd19871))
* **mcp:** show connected MCP clients in the app ([957d8e2](https://github.com/alanrsoares/mdreadr/commit/957d8e21f2c580ae332e12df810a753bbeb415b9))

## [0.2.1](https://github.com/alanrsoares/mdreadr/compare/v0.2.0...v0.2.1) (2026-07-19)


### Bug Fixes

* **ci:** build theme before typecheck ([62cf8ac](https://github.com/alanrsoares/mdreadr/commit/62cf8ac5260618eeb0f89b0b13737c5107e0d33c))

## [0.2.0](https://github.com/alanrsoares/mdreadr/compare/v0.1.1...v0.2.0) (2026-07-19)


### Features

* add "Install command in PATH" app menu action ([06486d5](https://github.com/alanrsoares/mdreadr/commit/06486d5e8459e35b0ccf13cfa8a4cc128b4214e7))
* **api:** embed mcp server for notes loops ([f768bdd](https://github.com/alanrsoares/mdreadr/commit/f768bddf5ed07bf0e0b1f2a64fadd134c2a26fb2))
* **api:** journal-backed session events + wait_for_activity ([18c8d95](https://github.com/alanrsoares/mdreadr/commit/18c8d9541d92fa325a8d587008271c541834c14e))
* **api:** typed MCP schemas + block-scoped document read ([cd7b79c](https://github.com/alanrsoares/mdreadr/commit/cd7b79c459480df6d2e217e00f0e339188ff2744))
* **domain:** add note kind for comment/request ([380ad89](https://github.com/alanrsoares/mdreadr/commit/380ad89f5c32ecb0ee5a73374e863a38c72f7b1f))
* **domain:** add Suggestion — agent-proposed anchored patch ([bd4eea3](https://github.com/alanrsoares/mdreadr/commit/bd4eea3a4771d5d4f76425489d00c34194865c02))
* **mcp:** in-app settings UI with persistent, revocable agent token ([8acf7f1](https://github.com/alanrsoares/mdreadr/commit/8acf7f188aa494fdd3025c438b74a669f573a968))
* resizeable notes sidebar ([63fa6ba](https://github.com/alanrsoares/mdreadr/commit/63fa6ba6033532638d98fd3d459a4ff091bff427))
* **ui:** integrate CodeMirror editor ([1ec2065](https://github.com/alanrsoares/mdreadr/commit/1ec2065cd6badb994ee2dfb6c5f5b809637a2422))


### Bug Fixes

* **api:** per-session MCP transport instead of global reset ([6ca6302](https://github.com/alanrsoares/mdreadr/commit/6ca6302ae8d9b6710726504ba50458d4afaad7a5))
* **api:** scope save_session_notes to safe directories ([ec54208](https://github.com/alanrsoares/mdreadr/commit/ec54208686de6ce76718e9223cfad0588cd7f2fd))
* **mcp-stdio-proxy:** reconnect + resume via persisted journal ([8dd35ec](https://github.com/alanrsoares/mdreadr/commit/8dd35ec5990d892b66a686d8f2d1b118de533168))
* **ui:** notes sidebar no longer clips composer/replies horizontally ([ec72147](https://github.com/alanrsoares/mdreadr/commit/ec72147ccca1a31ba40b513b641ec9571056af28))
