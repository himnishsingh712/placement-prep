/* Full worked walkthroughs, interviewer–candidate style, written in our own words.
   Batch 1 (22 Nov): Google's digital case kit. More batches add the casebook cases. */
const I = t => `<p class="wt-i"><b>Interviewer:</b> ${t}</p>`;
const Y = t => `<p class="wt-y"><b>You:</b> ${t}</p>`;
const N = t => `<p class="note">${t}</p>`;

export const FULL = {
  x47: I('A gaming app\'s cost per install (CPI) has gone up 40% in three months, and installs are flat. What\'s happening?')
    + Y('Before I diagnose, a few questions. Is spend up too, or did we keep budget flat and get fewer installs per rupee? Which channels: Google App campaigns only, or Meta and networks too? And has anything changed in the app, the store listing or tracking?')
    + I('Spend is up about 40%, installs flat. Mostly Google App campaigns. No product change. The team updated the attribution SDK two months ago.')
    + Y('So we pay 40% more for the same installs. CPI = cost per click ÷ install rate (clicks to installs). I\'ll check which of the two moved. Cost per click rises with auction competition, lower ad quality or creative fatigue. Install rate falls with a weaker store page, the wrong audience or broken tracking.')
    + I('CPC is up about 10%. Install rate is down about 25%.')
    + Y('So most of it is conversion, not price. Three suspects: (1) Tracking: after the SDK update, are installs being under-reported? I\'d compare store-console installs with what the ad platform sees. (2) Store page: ratings, screenshots, a recent bad review wave. (3) Creative fatigue pulling in lower-intent clicks.')
    + I('Store-console installs are 18% higher than the ad platform reports.')
    + Y('Then a big part is measurement: real installs didn\'t fall as much, but the bidding system thinks they did and bids worse. Fix the SDK integration and the conversion mapping first, and let bidding relearn. Then: refresh creative (new video and playable ads), test store-page variants, and move optimisation from installs to in-app actions such as day-7 retention or first purchase, so we buy valuable players, not just installs.')
    + I('Summarise for the client.')
    + Y('About two-thirds of the CPI rise comes from a tracking gap after the SDK update; the rest from creative fatigue and a 10% auction rise. Fix tracking this week, refresh creative within two weeks, and switch to value-based optimisation. Target: CPI back within 10% of its old level in six weeks, judged on cost per retained player.')
    + N('Key moves: split the metric, ask for data, find the measurement trap, end with a dated plan and a target.'),

  x48: I('A furniture retailer has 60 stores, and 90% of sales happen offline. How should it use Google to grow store sales?')
    + Y('Let me understand the buyer journey. Furniture is a high-ticket, considered purchase: people research online for weeks, then visit a store to touch and feel. So the job of digital is to drive qualified store visits, not only online orders. Can I ask the goal and what they do today?')
    + I('Grow total sales 20% in a year. Today they run a little Search on their brand name.')
    + Y('I\'d structure it in three layers along the funnel. (1) Be found when people search: claim and optimise all 60 Google Business Profiles (photos, hours, reviews, products), Search ads on category terms like "sofa set near me" with location extensions, and a local product feed so stock shows near the shopper. (2) Create demand: YouTube and Demand Gen with room-makeover content, targeted to people moving house or getting married. (3) Convert and measure: Performance Max for store goals, with store visits and calls as conversions; collect leads for appointment bookings.')
    + I('How will you prove that ads drive store sales?')
    + Y('Three ways. Store-visit conversions modelled by Google. Upload offline sales against leads and calls (offline conversion import). And a geo test: turn spend up in some cities and hold others back, then compare store sales. That last one convinces a CFO.')
    + I('Budget?')
    + Y('Work back from the goal: 20% growth on, say, ₹300 crore is ₹60 crore. If an average order is ₹60,000, that\'s 10,000 extra orders. At a store conversion of ~20% of visits, we need ~50,000 extra qualified visits. If digital drives a visit for ~₹500, that\'s about ₹2.5 crore of spend, a ~24× return on revenue. Start with ₹1 crore in the six strongest cities, prove it with the geo test, then scale.')
    + N('Key moves: map the offline journey, use funnel layers, measurement that convinces a CFO, budget from the goal backwards.'),

  x49: I('A brand\'s CMO says YouTube is "just awareness" and wants to cut it. How do you show its value?')
    + Y('First, I\'d find out how they measure today. If they judge every channel on last-click sales, YouTube will always look weak, because people watch, then search later. So the question is how YouTube changes behaviour downstream.')
    + I('They use last click in Google Analytics.')
    + Y('Then I\'d propose three pieces of evidence. (1) Brand and search lift studies: did people who saw the ads remember the brand more and search for it more? (2) Data-driven attribution, which gives YouTube credit for assisted conversions. (3) The strongest: a geo or conversion-lift experiment, where we hold out a random group or some cities from YouTube and compare sales.')
    + I('And if YouTube really does underperform?')
    + Y('Then we change how we run it before we cut it: action-focused formats (Demand Gen, video with product feeds), Shorts for younger buyers, creative built for the first five seconds, and the right audiences. I\'d agree with the CMO on a 6–8 week test with a decision rule: if incremental sales per rupee beat a set threshold, keep and scale; if not, reduce. The CMO gets a clear, fair test, not an argument.')
    + N('Key moves: question the measurement, offer incrementality, agree a decision rule upfront.'),

  x50: I('Thirty percent of first-time small advertisers stop using Google Ads within 90 days. Fix it.')
    + Y('I\'ll look at it as a retention funnel: sign up → set up a first campaign → first results → see value → keep paying. Which step loses them? Do we have data by business type, budget and acquisition channel?')
    + I('Most leave after 4–6 weeks. Those with tracking set up stay much more.')
    + Y('That tells me the problem is "no visible value". Small owners spend money, see clicks but no proof of calls or sales, and stop. Fixes by stage: (1) Setup: guided onboarding, simple goals ("get calls", "get visits"), automatic call and message tracking, a Business Profile link. (2) First 30 days: a realistic expectations message (learning period), a weekly plain-language report ("23 people called you"), alerts if something breaks. (3) Days 30–90: a human or AI-assisted check-in for those at risk, recommendations that are easy to apply, success stories from similar businesses.')
    + I('How do you know who is at risk?')
    + Y('Build a simple risk score: no conversion tracking, no conversions in 14 days, budget below what the category needs, low ad strength. Send the highest-risk accounts to a specialist call. Measure 90-day retention by cohort, test each fix against a control, and track revenue retained, not just accounts saved.')
    + N('Key moves: retention funnel, find the "value moment", fixes per stage, risk score, cohort testing.'),

  x51: I('An education advertiser says both organic and paid traffic fell after AI summaries started showing in search results. What do you advise?')
    + Y('I\'d first check whether demand fell or only clicks did. Are searches for their courses still as high? If impressions are stable but clicks fell, people are getting answers on the results page. If impressions fell, it\'s demand or competition.')
    + I('Impressions are flat; click-through is down, especially on informational queries.')
    + Y('Then the shift is in the top of the funnel: "what is data science" style queries now get answered without a click. That\'s less damaging than it looks, because those visitors convert poorly. My advice: (1) Measure on leads and enrolments, not clicks. (2) Paid: move budget to high-intent queries ("data science course fees", "online MBA admission"), use broad match with AI-powered campaigns so ads can appear in and around AI experiences, and strengthen assets. (3) Organic: content that AI systems cite, meaning clear, expert, structured pages with original data, FAQs and reviews. (4) Build direct demand: YouTube, email and WhatsApp so they rely less on search clicks.')
    + I('What would you tell their CEO in one line?')
    + Y('"We\'re losing cheap, low-intent clicks, not students; we\'ll protect enrolments by moving spend to high-intent searches, getting cited in AI answers and building our own audience."')
    + N('Key moves: demand vs click diagnosis, segment queries by intent, adapt to AI search on paid and organic.'),

  x52: I('A D2C electronics brand wants to win the festive sale season with a fixed budget. Plan it on Google.')
    + Y('Questions first: what does "win" mean (revenue, new customers, share)? Budget and margin? Where do they sell: own site, marketplaces or both? Which products are heroes?')
    + I('Revenue on their own website. ₹2 crore budget. Earbuds and smartwatches are the heroes.')
    + Y('I\'d plan it in three phases. (1) Build-up, 3–4 weeks before: YouTube and Demand Gen to grow consideration and remarketing lists; teaser offers; collect emails and app installs. (2) Peak sale days: most of the budget, about 60%, on Search and Performance Max with a clean product feed, sale prices and promotions in the feed, raised budgets and targets set for the expected higher conversion rate, and brand-term protection against competitors. (3) After the sale: remarketing to near-buyers and accessories cross-sell.')
    + I('How do you stop the budget running out on day one?')
    + Y('Plan daily budgets against forecast demand by day, keep about 10% in reserve, watch hourly, and shift money to the best-returning products and campaigns. Also check stock: never advertise sold-out items. Success measures: revenue and ROAS against the target, new-customer share and cost per new customer.')
    + N('Key moves: phase the season, protect peak days, product feed and pricing, pacing control.'),

  x53: I('A fintech app\'s 30-day retention fell from 38% to 29% after a redesign. Diagnose it.')
    + Y('I\'ll confirm it\'s real and caused by the redesign: did the fall start on the release date? Is it in all acquisition channels, or did we also change marketing? Is it Android and iOS?')
    + I('It started at release, across channels and both platforms.')
    + Y('So it\'s the product. I\'d compare the funnel before and after: install → sign-up → KYC → first transaction → second transaction. Where is the biggest new drop?')
    + I('KYC completion fell from 70% to 52%.')
    + Y('Then the redesign made KYC harder. Look at session recordings and drop-off per field; ask a few users. Common causes: more steps, a document upload screen that fails on low-end phones, unclear error messages. Fix: restore the shorter flow or save progress, allow finishing later with reminders by push and WhatsApp, and reward the first transaction. Run an A/B test of the fixed flow against the old one and track KYC completion and 30-day retention by cohort.')
    + N('Key moves: confirm the cause, walk the funnel, find the broken step, test the fix.'),

  x54: I('A marketplace wants to grow ad revenue from its sellers by 50% without hurting shoppers.')
    + Y('Ad revenue = number of advertising sellers × average spend. What are they today, and how many sellers sell but don\'t advertise?')
    + I('About 15% of active sellers advertise.')
    + Y('That\'s the biggest lever. (1) More advertisers: one-click "auto campaigns" for small sellers, free credits for first campaigns, simple reporting of sales from ads. (2) More spend per advertiser: better ROAS reporting, new formats (video, brand pages, off-site ads on Google and social), budget recommendations. (3) Protect shoppers: limit ads per page, keep relevance thresholds, and track shopper conversion and satisfaction per session as a guardrail.')
    + I('Rough maths for 50%?')
    + Y('If advertisers grow from 15% to 20% of sellers, that\'s +33%. If spend per advertiser rises ~12% from better formats and reporting, together that\'s about 1.33 × 1.12 ≈ 1.5. So 50% is reachable without raising ad load.')
    + N('Key moves: revenue tree, find the biggest lever, guardrail metric, the maths that lands on the target.'),

  x55: I('A jewellery brand wants to use YouTube to reach first-time buyers aged 22–30. Plan it.')
    + Y('Who are they and why would they buy? I\'d guess: young working women buying for themselves (everyday or office wear), and gifting. The barrier: jewellery feels like a wedding or a mother\'s purchase, and gold feels expensive.')
    + I('Agreed. Go on.')
    + Y('Message: lightweight, everyday, self-reward, with price points shown. Plan: (1) Reach: Shorts with creators styling pieces for work and weekends; bumper ads for frequency. (2) Consideration: longer films with a story (first salary, a personal milestone); product feeds on video so people can browse. (3) Action: remarketing to viewers with store-locator and online-store ads, and a try-at-home or store-appointment offer. Timing: around paydays, Valentine\'s, Raksha Bandhan and Akshaya Tritiya. Measure brand lift and search lift among 22–30, store visits and online sales, and refresh creative monthly.')
    + N('Key moves: insight first, funnel by format, timing to occasions, measurement.'),

  x56: I('A D2C brand wants to sell through WhatsApp. How should it start?')
    + Y('What do they sell, and what\'s their repeat rate? WhatsApp works best where customers re-order or need help choosing.')
    + I('Personal care, decent repeat rate, lots of abandoned carts.')
    + Y('Start with abandoned-cart recovery because it shows ROI fastest: a message within an hour with the cart and a one-tap checkout link. Then order updates (cheap, useful, build trust), then re-order reminders timed to product life (e.g. day 45 for a 60-day bottle), then a catalogue for browsing and simple support. Build an opt-in base from checkout, packaging QR codes and click-to-WhatsApp ads. Keep frequency low and personal, using CleverTap-style segmentation. Measure revenue per message, recovery rate, opt-out rate and cost per message.')
    + N('Key moves: start with the fastest ROI, sequence use cases, consent and frequency, clear metrics.')
};
