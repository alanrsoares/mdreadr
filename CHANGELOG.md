# Changelog

## [0.17.0](https://github.com/alanrsoares/mdreadr/compare/v0.16.1...v0.17.0) (2026-09-10)


### Features

* **domain:** confirm the pointed-at sub-block against the source scan ([#68](https://github.com/alanrsoares/mdreadr/issues/68)) ([161749b](https://github.com/alanrsoares/mdreadr/commit/161749b1e61d7b319ce9d52dbb8ac883165cb26c))


### Bug Fixes

* **ui:** draw diagrams in the reader's own colours ([#70](https://github.com/alanrsoares/mdreadr/issues/70)) ([fbbbbcf](https://github.com/alanrsoares/mdreadr/commit/fbbbbcfe77390398e31aed042204b345f7e2bd72))

## [0.16.1](https://github.com/alanrsoares/mdreadr/compare/v0.16.0...v0.16.1) (2026-09-09)


### Bug Fixes

* **ui:** harden tab activation ([4b30951](https://github.com/alanrsoares/mdreadr/commit/4b30951bcc6f7cf8cc1a0139d0331dfc0ef0a36c))


### Performance Improvements

* **ui:** contain reader tab rendering ([edbb126](https://github.com/alanrsoares/mdreadr/commit/edbb1269a9f51709204ffe25dec53d7b47b462a4))
* **ui:** contain reader tab rendering ([8fff299](https://github.com/alanrsoares/mdreadr/commit/8fff29929cb29da4d4089a14aeb3f7b286ab1536))

## [0.16.0](https://github.com/alanrsoares/mdreadr/compare/v0.15.1...v0.16.0) (2026-09-08)


### Features

* **repo:** add rpm, deb, and flatpak packaging ([62e806a](https://github.com/alanrsoares/mdreadr/commit/62e806abc1bfe76809487845d1f5e3f5156769fb))

## [0.15.1](https://github.com/alanrsoares/mdreadr/compare/v0.15.0...v0.15.1) (2026-09-08)


### Bug Fixes

* **ui:** remap targets in split tails ([e5c914b](https://github.com/alanrsoares/mdreadr/commit/e5c914b9a3adb869cfc8e3b603fc86190e225e3a))

## [0.15.0](https://github.com/alanrsoares/mdreadr/compare/v0.14.0...v0.15.0) (2026-09-08)


### Features

* granular inline-edit targeting for list items and table rows ([ad50113](https://github.com/alanrsoares/mdreadr/commit/ad50113889664b064c6382d3891b8a79cf8654c3))


### Bug Fixes

* **domain:** count only real items and rows ([0d58536](https://github.com/alanrsoares/mdreadr/commit/0d58536108e1db48e1f8009988a083c58afc6350))
* **ui:** keep the block around a header or nested edit ([abc0744](https://github.com/alanrsoares/mdreadr/commit/abc0744845570fd6567181f36ae8e0d1c27cf218))

## [0.14.0](https://github.com/alanrsoares/mdreadr/compare/v0.13.2...v0.14.0) (2026-09-08)


### Features

* **api:** add a route to forget one recent ([0dd4ce2](https://github.com/alanrsoares/mdreadr/commit/0dd4ce2ce454e3fff8c6f300fdca3b2ecb86b9cf))
* **domain:** classify a document by its path ([bab9464](https://github.com/alanrsoares/mdreadr/commit/bab9464ffbae258898aa50a67bcdc5086b766520))
* **ui:** add a right-click menu to anchored blocks ([2a213b2](https://github.com/alanrsoares/mdreadr/commit/2a213b2e6781825555eea0f81eae0ffc4c726a36))
* **ui:** follow links to non-markdown neighbours ([a237380](https://github.com/alanrsoares/mdreadr/commit/a2373809e7552b15702afa5e3a95f4c14db9918a))
* **ui:** give recents rows a quick actions menu ([b269360](https://github.com/alanrsoares/mdreadr/commit/b269360d5060913be82b7ef30d343ebdfe2133f7))
* **ui:** merge notes and suggestions into one review column ([39aff1e](https://github.com/alanrsoares/mdreadr/commit/39aff1e91276d4c492800d87ec23831cafc989c8))
* **ui:** open non-markdown files in a tab ([fa54b83](https://github.com/alanrsoares/mdreadr/commit/fa54b8373a79dbd9c77fbcb2bed438e910e8deaa))
* **ui:** open source and image files in a tab ([7c1ad69](https://github.com/alanrsoares/mdreadr/commit/7c1ad69edbf5312e9c5d454d193ebefd73b93638))


### Bug Fixes

* **ui:** say Anchor, not Pin, in block control copy ([45cd058](https://github.com/alanrsoares/mdreadr/commit/45cd0589771956d24493ed9d91047f7c00645ea7))
* **ui:** survive a malformed link escape ([6922ded](https://github.com/alanrsoares/mdreadr/commit/6922dedcdc1d4b4fde4edea33f3bfef3ff586fde))

## [0.13.2](https://github.com/alanrsoares/mdreadr/compare/v0.13.1...v0.13.2) (2026-09-07)


### Bug Fixes

* **release:** drop the Intel macOS target ([d3b0479](https://github.com/alanrsoares/mdreadr/commit/d3b04799013b337111606bac07699da05f7dceab))
* restore the macOS release build ([916e843](https://github.com/alanrsoares/mdreadr/commit/916e843936955d70738f834e368eed07dad1afad))
* **smoke:** prove the app is serving instead of watching stdout ([6babb80](https://github.com/alanrsoares/mdreadr/commit/6babb80723e11e24e6d4a6451a897df6c44837d2))
* **smoke:** stop the teardown from killing the test itself ([a03ded7](https://github.com/alanrsoares/mdreadr/commit/a03ded7f3d0510f3926b1381bc38c417dfb8c39d))

## [0.13.1](https://github.com/alanrsoares/mdreadr/compare/v0.13.0...v0.13.1) (2026-09-07)


### Bug Fixes

* **release:** match electrobun 2 artifact names ([e04b24b](https://github.com/alanrsoares/mdreadr/commit/e04b24b06ffcb036d23d5b3f493c654c22620b65))

## [0.13.0](https://github.com/alanrsoares/mdreadr/compare/v0.12.2...v0.13.0) (2026-09-07)


### Features

* **api:** open a document's web links in the OS browser ([cf24d6a](https://github.com/alanrsoares/mdreadr/commit/cf24d6ab159917576a62da9564bb49b18fd9dec6))
* **reader:** add pure inline markdown edit ops ([2982d18](https://github.com/alanrsoares/mdreadr/commit/2982d185fa0f6c4985da568c73ee78c8f69b77c6))
* **reader:** follow a document's links inside the app ([490dd39](https://github.com/alanrsoares/mdreadr/commit/490dd3988c440eef8883a77f35a58d43b1096d3f))
* **reader:** hold the block still during inline edit ([ba4ecb2](https://github.com/alanrsoares/mdreadr/commit/ba4ecb28f426ed78065be9db19b65eeb66dc48c2))
* **reader:** inline-edit sweep and in-app document links ([93a7a43](https://github.com/alanrsoares/mdreadr/commit/93a7a43295910c50589a1c7746cad71294f01526))

## [0.12.2](https://github.com/alanrsoares/mdreadr/compare/v0.12.1...v0.12.2) (2026-09-07)


### Bug Fixes

* **ci:** exit the smoke test once the app is up ([c8ad7c8](https://github.com/alanrsoares/mdreadr/commit/c8ad7c8c7211e07c3a966c308d8b280406ebede8))
* **ci:** exit the smoke test once the app is up ([8c8c6d2](https://github.com/alanrsoares/mdreadr/commit/8c8c6d29f28f35603071e53fb0f47ac184665897))

## [0.12.1](https://github.com/alanrsoares/mdreadr/compare/v0.12.0...v0.12.1) (2026-09-07)


### Bug Fixes

* **ci:** smoke test the real Linux app bundle ([3e7960b](https://github.com/alanrsoares/mdreadr/commit/3e7960bf30d98af177f65b13c4beb05933944551))
* **ci:** smoke test the real Linux app bundle ([1fcc4df](https://github.com/alanrsoares/mdreadr/commit/1fcc4dfd8fe0f5a93109b10b745c4bcb929a9190))

## [0.12.0](https://github.com/alanrsoares/mdreadr/compare/v0.11.0...v0.12.0) (2026-09-07)


### Features

* **anchors:** anchor list and table blocks ([9a8f727](https://github.com/alanrsoares/mdreadr/commit/9a8f7279aa187e0623b23e7b1f75bdf0334f1b42))
* **reader:** seamless preview/edit toggle ([f122a48](https://github.com/alanrsoares/mdreadr/commit/f122a48b54012d7de03a6b1c0fe4b2d2deb6a12a))
* **reader:** tune measure, gutter, block cursor ([620217e](https://github.com/alanrsoares/mdreadr/commit/620217e5de20fc04e21cab1dd0bc2b28e09fbd5e))
* **reader:** tune the measure and make preview/edit seamless ([c0273bc](https://github.com/alanrsoares/mdreadr/commit/c0273bcd509821611b41afaf70962026dc8756e3))


### Bug Fixes

* **reader:** stand block cursor down while editing ([416210c](https://github.com/alanrsoares/mdreadr/commit/416210cb365986a976fe5e25d9fe9ad328ed00c8))

## [0.11.0](https://github.com/alanrsoares/mdreadr/compare/v0.10.3...v0.11.0) (2026-09-07)


### Features

* add version badge ([0a0bd50](https://github.com/alanrsoares/mdreadr/commit/0a0bd5035642ab8b953b3d1c58a7aaecc4904089))
* improved distributability coverage + wired undo/redo bridge ([bab4fdb](https://github.com/alanrsoares/mdreadr/commit/bab4fdbb8bec9dfd90d149a7988bea7de2577326))
* **reader:** flash blocks changed on disk ([cb098a6](https://github.com/alanrsoares/mdreadr/commit/cb098a6c1ac7a8c0a40d01821f50ee45928a1717))
* **ui:** add inline block editing and polish reader chrome ([cd5553e](https://github.com/alanrsoares/mdreadr/commit/cd5553e36bfc760368502ca6c85dbb89fd3cd185))


### Bug Fixes

* **shell:** restrict localhost devserver to non-stable ([bdd6c55](https://github.com/alanrsoares/mdreadr/commit/bdd6c554006ba177a62e17056ef00c6dab98d565))

## [0.10.3](https://github.com/alanrsoares/mdreadr/compare/v0.10.2...v0.10.3) (2026-08-13)


### Bug Fixes

* more responsive doc loading ([a32fcb9](https://github.com/alanrsoares/mdreadr/commit/a32fcb97196b9446bb4395de1b7801a99234b431))
* tab activation/close optimistic updates ([b137ef6](https://github.com/alanrsoares/mdreadr/commit/b137ef68dbcbac0407716f9b38045bae074067c5))
* theme build ([8d20312](https://github.com/alanrsoares/mdreadr/commit/8d20312b8f375c32fcbbb64213345b65a7431809))

## [0.10.2](https://github.com/alanrsoares/mdreadr/compare/v0.10.1...v0.10.2) (2026-08-13)


### Bug Fixes

* **ui:** fix sidebar toggle overrides caused by render effects ([bc00a03](https://github.com/alanrsoares/mdreadr/commit/bc00a030e767781a2b142267003f516d6e5555aa))
* **ui:** unify recents sidebar state with RecentsSidebarProvider ([b3de5a7](https://github.com/alanrsoares/mdreadr/commit/b3de5a73dcde4a990e0638a71f88145788fa3ceb))

## [0.10.1](https://github.com/alanrsoares/mdreadr/compare/v0.10.0...v0.10.1) (2026-08-12)


### Bug Fixes

* **ui:** enable collapse toggle and restore button for left sidebar ([a67548d](https://github.com/alanrsoares/mdreadr/commit/a67548dd64c99a724e88412451dbeb6f803700f1))

## [0.10.0](https://github.com/alanrsoares/mdreadr/compare/v0.9.0...v0.10.0) (2026-08-12)


### Features

* mcp code mode ([08db392](https://github.com/alanrsoares/mdreadr/commit/08db392d80b219f1e281fb0fa810e6c7f4766a4a))
* **ui:** add top-right font size UX and fluid scaling ([b09ce71](https://github.com/alanrsoares/mdreadr/commit/b09ce7164823b8c05540d33ddfb82d3ffb46d8f4))
* **ui:** auto-expand sidebars when screen has horizontal room ([0b73d99](https://github.com/alanrsoares/mdreadr/commit/0b73d9910cd8bd06e7f87c3a948f18788d7a80f1))
* **ui:** refine table font scaling and button feedback ([9772205](https://github.com/alanrsoares/mdreadr/commit/9772205e893777808ca144f504ff04820918ed9d))


### Bug Fixes

* **ui:** enforce reader prose font family on body elements ([72c7b23](https://github.com/alanrsoares/mdreadr/commit/72c7b234481539582eade6c902f1dd43a6a5dd56))

## [0.9.0](https://github.com/alanrsoares/mdreadr/compare/v0.8.0...v0.9.0) (2026-08-12)


### Features

* **ui:** add font adjustment UX & theme toggle ([5860a31](https://github.com/alanrsoares/mdreadr/commit/5860a31e6d71ee33470b37c4a867793d3776bd22))

## [0.8.0](https://github.com/alanrsoares/mdreadr/compare/v0.7.0...v0.8.0) (2026-08-08)


### Features

* **ui:** scale diagram preview to fit in fullscreen ([e23a48a](https://github.com/alanrsoares/mdreadr/commit/e23a48a79ca103cd4949a46b3ff3375e2ccb7c19))

## [0.7.0](https://github.com/alanrsoares/mdreadr/compare/v0.6.0...v0.7.0) (2026-07-29)


### Features

* **markdown:** add D2 diagram support, extract shared diagram viewer ([fc74312](https://github.com/alanrsoares/mdreadr/commit/fc74312840bb7c7b2d20d56174eaadc70ecdd240))

## [0.6.0](https://github.com/alanrsoares/mdreadr/compare/v0.5.1...v0.6.0) (2026-07-28)


### Features

* **mcp:** add open_document tool to switch the current document by path ([358b34d](https://github.com/alanrsoares/mdreadr/commit/358b34d2141b58c0a1e92617d3d68857d143f95e))


### Bug Fixes

* **reader:** restore height chain so TOC sidebar stays pinned on scroll ([5eee8e6](https://github.com/alanrsoares/mdreadr/commit/5eee8e66a62b1fb3cc8628e79670d8b3c1ea7e56))

## [0.5.1](https://github.com/alanrsoares/mdreadr/compare/v0.5.0...v0.5.1) (2026-07-23)


### Bug Fixes

* patch desktop entry env vars in Linux installer ([5ae826a](https://github.com/alanrsoares/mdreadr/commit/5ae826af32afe7d0fcfd701faa45c01102b49d77))
* patch desktop entry env vars in Linux installer ([3b1abd7](https://github.com/alanrsoares/mdreadr/commit/3b1abd76aeef1a09d3566eac5df2ac6a2ca7c681))
* **webview:** encode tab ids before building Eden Treaty tab routes ([85acc52](https://github.com/alanrsoares/mdreadr/commit/85acc52ff596194c5c5cc5336e96e9c83eb076d0))

## [0.5.0](https://github.com/alanrsoares/mdreadr/compare/v0.4.1...v0.5.0) (2026-07-23)


### Features

* multi-document tabs ([e2a811e](https://github.com/alanrsoares/mdreadr/commit/e2a811ece96a63f80cd3d99ebcad38b4de92c0fb))

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
