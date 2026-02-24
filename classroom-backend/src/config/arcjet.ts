import arcjet, { shield, detectBot, tokenBucket, slidingWindow } from "@arcjet/node";


if (!process.env.ARCJET_KEY && process.env.NODE_ENV !== 'test') {
throw new Error('ARCJET_KEY env is required')
}

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
      // Block all bots except the following
      allow: [
        "CATEGORY:SEARCH_ENGINE", 
        "CATEGORY:PREVIEW",
      ],
    }),
     slidingWindow({
        mode: 'LIVE' ,
        interval: '2', 
        max: 5,
     })
  ],
});

export default aj;