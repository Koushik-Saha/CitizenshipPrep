# Store assets

- **Listing text**, App Privacy and Data safety answers: `docs/store/listing.md`.
- **Icons and splash:** `assets/images/`, drawn by `pnpm brand:assets`
  (`scripts/brand-assets.mjs`).
- **Screenshots:** `store/screenshots/<device>/`, made by `pnpm store:screenshots`.

## Screenshots

| Folder          | Size (pixels) | Where it goes                                        |
| --------------- | ------------- | ---------------------------------------------------- |
| `ios-6.9`       | 1320 x 2868   | App Store, iPhone 6.9" (required)                    |
| `ios-6.5`       | 1242 x 2688   | App Store, iPhone 6.5"                               |
| `ipad-13`       | 2064 x 2752   | App Store, iPad 13" (required: the app runs on iPad) |
| `android-phone` | 1080 x 1920   | Google Play, phone                                   |
| `android-7in`   | 1200 x 1920   | Google Play, 7-inch tablet                           |
| `android-10in`  | 1600 x 2560   | Google Play, 10-inch tablet                          |

Six screens each: the study dashboard, a question, its explanation, the
results of a session, a flashcard, and the plans.

To make them again:

```bash
# 1. The web app, with the test sign-in on, against a database whose content
#    you are happy to show.
TEST_SIGN_IN_SECRET="$(openssl rand -hex 32)" pnpm --filter @oathly/web dev

# 2. A test learner who studies the country to show (finish onboarding once
#    in the browser build so the Study tab opens straight away).
curl "http://localhost:3000/api/test/sign-in?user=store&secret=$TEST_SIGN_IN_SECRET&as=token"

# 3. The app's browser build as that learner, then the screenshots.
EXPO_PUBLIC_TEST_SESSION="<the token>" pnpm --filter @oathly/mobile web
pnpm --filter @oathly/mobile store:screenshots
```

Two things to know before uploading them:

- **They show whatever that learner sees.** The ones in this folder were made
  from the development seed's sample questions for the United States, which
  nobody has reviewed. Make them again from published content.
- **They are a browser's rendering**, at each device's size and pixel density:
  the layout, colours and content are the app's, but there is no status bar
  and the text is drawn by a browser. Both stores accept them; screenshots
  taken on a phone look more like the phone.
