<p align="center">
  <img src="favicon.svg" width="88" height="88" alt="typingDrill logo">
</p>

<h1 align="center">typingDrill</h1>
<p align="center"><b>by HAMiD</b> · a focused, word-by-word typing practice app for typing tests</p>

---

typingDrill helps you build speed **and** accuracy for computer-based typing tests (SSC CHSL / DEO style and similar). You type one word at a time, and once you press <kbd>Space</kbd> you **cannot go back** to fix a previous word, just like many real exams.

It is a plain static website: no install, no build step, no server, no account. Everything is saved in your own browser.

## Features

**Typing practice**
- Word-by-word engine: <kbd>Space</kbd> moves to the next word, <kbd>Backspace</kbd> only works inside the current word
- Live green/red letter feedback, net WPM, gross WPM, accuracy and wrong-word count
- Timed tests (1, 2, 3, 5 min) or full-text mode
- Paste is blocked, so practice stays honest
- **Exam Mode** (High Court style): copy your own printed paper into a blank box with no live checking. When time ends you get speed, accuracy and hints at once from an English dictionary (spelling suggestions, capitals, punctuation spacing, repeated words), If your text matches one of the hidden papers in `exam-papers.js` (never shown on screen), it is scored exactly, word by word, against that paper instead. Word lists: SCOWL by Kevin Atkinson (`words-en.js`)

**Content** (all passages are original)
- **Exam & topic passages**, including a 375-word 10-minute exam-style test
- **Classic stories**: short fables and everyday paragraphs
- **Punctuation Pro**: dialogue, quotations, `! ? ; : ' "` and brackets
- **Tough-word stories** packed with the 40 words that slow most typists down: long words, double letters, confusing pairs (*their/there*, *affect/effect*…) and exam favourites (*rhythm*, *questionnaire*, *bureaucracy*…)
- **Word Drill** for any word group, and **Daily 10**: type 10 words while looking, then type them blind until you reach your unlock accuracy

**Progress**
- Result screen with every mistake (expected vs typed) and a one-click "Practice my mistakes" drill
- Performance page: best/average WPM, accuracy, WPM trend chart, most-missed words
- Editable goals (target WPM, minimum accuracy, Daily 10 unlock accuracy)
- **2-week 60 WPM plan** (admin only): 14 days of daily tasks with checkpoints at 50 WPM (day 7) and 60 WPM (day 14)

**Comfort**
- Light, dark and auto themes
- Four text sizes and four fonts (IBM Plex Sans, Arial, Serif, Mono). Arial is closest to many exam screens
- Live tab title showing your current WPM, and an animated logo that reacts to your typing

## Getting started

**Online:** if GitHub Pages is enabled for this repo, open
`https://hamie-kalhoro.github.io/typing-drill/`

**Offline:** download or clone the repo and open `index.html` in any modern browser.

```bash
git clone https://github.com/hamie-kalhoro/typing-drill.git
cd typing-drill
# then double-click index.html (or open it in your browser)
```

> Fonts load from Google Fonts. Without internet the app still works and falls back to system fonts.

## Sign-in and privacy

There is no backend. Student profiles live only in the browser where they were created.

- **One built-in admin for every device.** The admin's name and a slow PBKDF2 hash of the admin password ship with the site in `admin-config.js`. Nobody can create, claim or promote an admin from the browser, and the admin can't be deleted or have its password reset from the app.
- **Students** click *New here? Create a profile* and choose their own name and PIN. The admin's name is reserved.
- The sign-in screen never lists profiles. Everyone types their own name and PIN, every failure shows the same message, and 5 wrong attempts lock that name for 30 seconds.
- Each profile only sees its own progress. PINs are stored as salted SHA-256 hashes, never as plain text.

### Admin

Only the admin sees the **Admin** dashboard and the **60 WPM Plan**.

**Setting or changing the admin** (owner only):

1. Open `tools/admin-setup.html` in your browser (it runs offline; the password never leaves your computer).
2. Enter the admin name and a password of **at least 10 characters**. Don't use a short number: the hash is public in this repo, so short PINs can be guessed offline.
3. It downloads a new `admin-config.js`. Replace the one in the project folder, then commit and push.

Until `admin-config.js` is configured, nobody can sign in as admin (students work normally). The admin always re-enters the password after a page refresh.

- **All profiles** table: tests, best/average WPM, accuracy, plan progress, last activity
- Per-profile details: WPM trend, hardest words, recent results, **Reset PIN**, **Delete profile**
- **Backup everything** downloads all profiles and progress as one JSON file

### Students on other devices

Because data stays in each browser, students who practise on their own phone or laptop send their progress to the admin:

1. Student: **Performance → Export progress** (downloads a `.json` file) and sends it to the admin.
2. Admin: **Admin → Import progress files**. The profile appears with an *Imported* tag. Importing a newer file later merges it, keeping the best results.

### Limits

- This keeps profiles private from each other on a shared device, but it is **not server-grade security**. Someone with browser developer tools on the same device could read the raw stored data or run modified code locally. What they can't do is change the admin on the published site.
- Clearing the browser's site data deletes all profiles. Use **Backup everything** regularly.

## Project structure

```
index.html    page layout: sign-in, sidebar, practice, plan, stats, admin, dialogs
style.css     design tokens (light/dark), layout and components
app.js        typing engine, stats, plan, goals, sign-in, admin, export/import
texts.js      all passages and word lists (plain data)
admin-config.js         built-in admin (name + password hash), same on every device
tools/admin-setup.html  offline page that generates admin-config.js
favicon.svg   app icon (animated in browsers that support it)
```

## Adding your own passages

Open `texts.js` and add an entry to `STORIES`, `PUNCT_STORIES` or `TOUGH_STORIES`:

```js
{
  title: "My New Passage",
  text: `Type your paragraph here. Use plain keyboard characters
(straight quotes " and ', no curly quotes) so every symbol can be typed.`
}
```

Line breaks inside the text are ignored; words are split on whitespace. Only add text you wrote yourself or have the right to use.

## Keyboard shortcuts

| Key | Action |
|---|---|
| <kbd>Space</kbd> / <kbd>Enter</kbd> | Submit the current word |
| <kbd>Backspace</kbd> | Delete inside the current word only |
| <kbd>Esc</kbd> | Restart the current test |

## Tips to reach 45+ WPM

1. Accuracy first: slow down whenever accuracy drops below your goal.
2. Never look at the keyboard.
3. Ten focused minutes every day beats two hours once a week.
4. Practise punctuation keys until you can find them without looking.
5. Practise in **Arial** at a large text size to match exam conditions.

---

<p align="center">Made with care by <b>HAMiD</b></p>
