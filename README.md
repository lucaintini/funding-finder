# Funding finder

The source of [lucaintini.ai/funding](https://lucaintini.ai/funding): a free page that matches a startup or
project idea to grants, prizes, cloud and AI credits, accelerators and loans (tax incentives last) across
Australia, Canada, Italy, the Netherlands, the EU and global programs.

**It collects nothing.** The matching runs in your browser (`site/funding/match.js`) against a fixed list of
programs (`site/funding/data/*.json`, bundled into `programs.js`). The page is served with a Content Security
Policy of `connect-src 'none'` and `form-action 'none'`, so it cannot send what you type anywhere, and the
server keeps no access log for it.

- `site/funding/`: the page, the matcher and the program data.
- `tools/check_funding_data.py`: the data contract (every record checked, dated and linked to an official page).
- `tools/build_funding_data.py`: bundles the data into `programs.js`.
- `tools/check_funding_links.py`: the weekly link check.
- `tests/funding_match_test.js`: matcher tests (`node tests/funding_match_test.js`).

Suggestions for missing or wrong programs: [lucaintini.ai/funding/suggest](https://lucaintini.ai/funding/suggest).

This repository is a read-only mirror, published so anyone can check the page does what it says.
Copyright Luca Intini. All rights reserved.
