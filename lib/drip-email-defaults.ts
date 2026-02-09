export interface DripEmailDefault {
  subject: string;
  previewText?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}

const p = (text: string) => `<p style="margin: 0 0 16px; line-height: 1.6;">${text}</p>`;
const h = (text: string) => `<p style="margin: 24px 0 8px; font-weight: 600; font-size: 16px;">${text}</p>`;
const sig = `<p style="margin: 24px 0 0; line-height: 1.6;">Warmly,<br><strong>Roxanne</strong></p>`;

const dripEmailDefaults: Record<string, DripEmailDefault> = {
  // ============================================================
  // ONBOARDING SEQUENCE (12 emails, Days 0-30)
  // ============================================================

  onboarding_0: {
    subject: "Welcome to Life-Therapy \u2014 Your Free Assessment Is Here",
    previewText: "Plus a quick note from Roxanne about what\u2019s ahead...",
    ctaText: "Download Your Free Self-Esteem Snapshot",
    ctaUrl: "/free/self-esteem-snapshot/download",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Welcome to the Life-Therapy community \u2014 I\u2019m so glad you\u2019re here.")}
${p("Your free <strong>Self-Esteem Snapshot</strong> is ready for you. This short assessment will help you understand where you stand right now and which areas might benefit from some focused attention.")}
${p("Here\u2019s what to expect from me:")}
${p("Over the next few weeks, I\u2019ll send you practical tips, exercises, and insights that you can use right away \u2014 no fluff, no jargon, just real tools that work. I\u2019ve spent years developing these frameworks through my coaching practice, and I\u2019m sharing the best of what I know.")}
${p("A few things to know about me: I\u2019m a qualified life coach, counsellor, and NLP practitioner based in South Africa, working with clients around the world. I believe that confidence isn\u2019t something you\u2019re born with \u2014 it\u2019s something you build. And I\u2019m here to help you build it.")}
${p("Take 5 minutes with your assessment today. You might be surprised by what you learn.")}
${sig}`,
  },

  onboarding_1: {
    subject: "Why I Became a Life Coach (It Wasn\u2019t the Plan)",
    previewText: "Sometimes your biggest struggle becomes your greatest purpose...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("I want to share something personal with you today.")}
${p("I didn\u2019t set out to become a life coach. Like many of the people I work with, I spent years wrestling with my own confidence. I knew all the \u201Cright\u201D things intellectually \u2014 think positive, be grateful, believe in yourself \u2014 but knowing and feeling are two very different things.")}
${p("What changed everything for me wasn\u2019t a single moment. It was learning that self-esteem isn\u2019t a fixed trait. It\u2019s a skill. And like any skill, it can be developed, strengthened, and maintained with the right tools and practice.")}
${p("That\u2019s why I created Life-Therapy \u2014 to give people the practical frameworks I wish I\u2019d had. Not theory. Not motivational quotes. Real, evidence-based tools that actually shift how you feel about yourself.")}
${p("Every course, worksheet, and session I offer comes from this belief: <strong>you already have what it takes</strong>. Sometimes you just need someone to show you where to look.")}
${p("I\u2019m glad you\u2019re here. And I\u2019m looking forward to sharing more with you.")}
${sig}
${p('<em>P.S. Did you get a chance to complete your Self-Esteem Snapshot? If you missed it, you can <a href="/free/self-esteem-snapshot/download" style="color: #8BA889; font-weight: 600;">download it here</a>.</em>')}`,
  },

  onboarding_2: {
    subject: "The One Thing Most People Get Wrong About Self-Esteem",
    previewText: "It\u2019s not what you think (and fixing this changes everything)...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Here\u2019s the mistake I see almost everyone make: they confuse <strong>self-esteem</strong> with <strong>self-confidence</strong>.")}
${p("They\u2019re not the same thing.")}
${p("<strong>Self-confidence</strong> is believing you can DO something \u2014 give a presentation, learn a new skill, handle a difficult conversation. It\u2019s task-specific and situation-dependent.")}
${p("<strong>Self-esteem</strong> is believing you ARE someone worthy \u2014 of love, respect, success, and happiness. It\u2019s the foundation underneath everything else.")}
${p("You can be incredibly confident in your job but have low self-esteem. You can nail every presentation but still feel like a fraud. You can achieve goal after goal and still feel like you\u2019re not enough.")}
${p("Sound familiar?")}
${p("That\u2019s because confidence without self-esteem is a house built on sand. It looks good until the storm comes.")}
${p("The good news? Self-esteem can be built. It\u2019s not a personality trait you\u2019re stuck with \u2014 it\u2019s a set of beliefs and habits that can be changed with the right approach.")}
${p('Here\u2019s one thing you can try today: catch yourself the next time you say \u201CI\u2019m so stupid\u201D or \u201CI can\u2019t believe I did that.\u201D Pause. And ask yourself: <strong>would I say this to my best friend?</strong> If not, why are you saying it to yourself?')}
${p("That\u2019s the first step. Simple, but powerful.")}
${p("More on this next time.")}
${sig}`,
  },

  onboarding_3: {
    subject: "Try This: A 5-Minute Exercise That Shifts Your Self-Talk",
    previewText: "It takes less time than scrolling Instagram...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Last time I talked about the difference between confidence and self-esteem. Today I want to give you something you can actually use \u2014 right now, in the next 5 minutes.")}
${p('It\u2019s called the <strong>\u201CThought Record.\u201D</strong> It comes from cognitive behavioural therapy (CBT), and it\u2019s one of the most effective tools I use with my clients.')}
${p("Here\u2019s how it works:")}
<ol style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>Write down a negative thought</strong> you\u2019ve had about yourself recently. (Example: \u201CI\u2019m not good enough for that promotion.\u201D)</li>
<li>Ask yourself \u2014 what\u2019s the <strong>evidence FOR</strong> this thought? Write it down honestly.</li>
<li>Now ask \u2014 what\u2019s the <strong>evidence AGAINST</strong> this thought? Be just as honest.</li>
<li>Write a <strong>more balanced thought</strong>. Not fake positivity \u2014 just balanced. (Example: \u201CI have areas to develop, but I also have skills and experience that qualify me.\u201D)</li>
</ol>
${p("That\u2019s it. Five minutes. One thought.")}
${p("What you\u2019ll notice is that your brain serves up negative thoughts as <strong>FACTS</strong>. They feel true. But when you write them down and examine the evidence, they often don\u2019t hold up.")}
${p("This is the core of what I teach in my <strong>Foundations of Self-Esteem</strong> course \u2014 practical tools like this, but taken much deeper over 9 modules. But you don\u2019t need a course to start. You just need 5 minutes and a pen.")}
${p("Try it today. You might surprise yourself.")}
${sig}`,
  },

  onboarding_4: {
    subject: "Your Inner Critic Is Lying to You \u2014 Here\u2019s Proof",
    previewText: "That voice in your head? It\u2019s not telling the truth...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Everyone has an inner critic. That voice that says you\u2019re not smart enough, not attractive enough, not successful enough, not \u201Cenough\u201D in some fundamental way.")}
${p("Here\u2019s what most people don\u2019t realise: <strong>your inner critic isn\u2019t trying to hurt you.</strong> It\u2019s actually trying to protect you.")}
${p("At some point in your life \u2014 usually childhood \u2014 your brain learned that criticising yourself FIRST was safer than being criticised by others. If you already know you\u2019re not good enough, rejection can\u2019t surprise you. It\u2019s a survival strategy.")}
${p("The problem? You\u2019re not a child anymore. But the inner critic is still running the old programme.")}
${p('Here\u2019s what I want you to try: the next time your inner critic speaks up, instead of believing it or fighting it, just <strong>notice it</strong>. Say to yourself: \u201CThere\u2019s my inner critic again. It\u2019s trying to protect me. But I don\u2019t need that protection right now.\u201D')}
${p("This isn\u2019t about silencing the critic. It\u2019s about changing your <strong>relationship</strong> with it. When you stop treating it as the voice of truth and start seeing it as a well-meaning but outdated alarm system, it loses its power.")}
${p("This is actually the foundation of my entire <strong>Confidence from Within</strong> course \u2014 understanding where the inner critic comes from, identifying your specific patterns, and learning to transform that critical voice into a supportive one. It\u2019s some of the most powerful work I do with my clients.")}
${p("But for today, just notice. That\u2019s enough.")}
${sig}`,
  },

  onboarding_5: {
    subject: "The 5-Minute Morning Practice That Builds Real Confidence",
    previewText: "Consistency beats intensity. Every single time...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("I\u2019m going to give you something today that seems almost too simple. But I\u2019ve seen it transform my clients\u2019 relationship with themselves when they commit to it.")}
${p("It\u2019s a <strong>5-minute morning practice</strong>. Here it is:")}
${p("Every morning, before you check your phone, before emails, before the day pulls you in \u2014 sit for 5 minutes and answer these three questions in a notebook:")}
<ol style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>What is one thing I\u2019m grateful for about MYSELF today?</strong> (Not external things. Something about YOU \u2014 a quality, a strength, an effort you made.)</li>
<li><strong>What is one kind thing I can do for myself today?</strong> (This can be as small as taking a 10-minute walk or as big as saying no to something that drains you.)</li>
<li><strong>What would I do today if I fully trusted myself?</strong> (Just write whatever comes to mind. No judgement.)</li>
</ol>
${p("That\u2019s it. Three questions. Five minutes.")}
${p("The magic isn\u2019t in the individual answers. It\u2019s in the repetition. After a week, you\u2019ll start noticing shifts. After a month, you\u2019ll wonder why you didn\u2019t start sooner.")}
${p("<strong>Consistency beats intensity.</strong> Five minutes daily is more powerful than an hour-long journaling session once a month.")}
${p("Will you try it tomorrow morning? Hit reply and tell me if you do. I\u2019d love to hear how it goes.")}
${sig}`,
  },

  onboarding_6: {
    subject: "\u201CShe Helped Me Believe in Myself Again\u201D \u2014 Real Stories",
    previewText: "What happens when you actually do the work...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("I want to share a few words from people who\u2019ve walked this path before you. Not because I want to sell you anything today \u2014 but because I think it helps to know you\u2019re not alone.")}
<blockquote style="border-left: 3px solid #8BA889; padding: 12px 16px; margin: 16px 0; background: #f9fafb; font-style: italic; line-height: 1.6;">
\u201CI can\u2019t recommend Roxanne highly enough. She created such a warm, supportive space where I always felt heard, understood, and gently guided. Her insight, compassion, and care made a meaningful difference in my life.\u201D<br><strong style="font-style: normal;">\u2014 Frances, Knysna</strong>
</blockquote>
<blockquote style="border-left: 3px solid #8BA889; padding: 12px 16px; margin: 16px 0; background: #f9fafb; font-style: italic; line-height: 1.6;">
\u201CAt a time when I was at my lowest, she helped me get through it and believe in me again. And it was done with patience, kindness and understanding.\u201D<br><strong style="font-style: normal;">\u2014 Casey-Lea, Johannesburg</strong>
</blockquote>
<blockquote style="border-left: 3px solid #8BA889; padding: 12px 16px; margin: 16px 0; background: #f9fafb; font-style: italic; line-height: 1.6;">
\u201CRoxanne\u2019s insights and strategies have helped me develop the confidence to establish and maintain healthy boundaries in my relationships. I highly recommend her to anyone seeking effective and empathetic therapy.\u201D<br><strong style="font-style: normal;">\u2014 Tasmin, Paarl</strong>
</blockquote>
${p("These aren\u2019t exceptional people with special advantages. They\u2019re ordinary people who decided to invest in themselves. And that decision \u2014 showing up, doing the work, being willing to grow \u2014 made all the difference.")}
${p("You\u2019ve already taken that first step by being here. Whatever you choose to do next, know that I\u2019m here to support you.")}
${sig}`,
  },

  onboarding_7: {
    subject: "Ready to Go Deeper? Here Are Your Options",
    previewText: "From free tools to full courses \u2014 choose your path...",
    ctaText: "Explore All Options",
    ctaUrl: "/courses",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Over the past two weeks, I\u2019ve shared some of my favourite tools and insights with you. If they\u2019ve resonated, you might be wondering: what\u2019s the next step?")}
${p("I\u2019ve designed several ways to continue your growth journey, depending on what suits you:")}
${h("START SMALL \u2014 Short Courses")}
${p("Pick a single topic that resonates and dive in. Each short course is one focused module (~45 minutes) with a downloadable worksheet. Topics like \u201CChallenging Negative Self-Talk,\u201D \u201CBuilding Self-Trust,\u201D and \u201CThe 5 Types of Self-Sabotage\u201D are popular starting points.")}
${h("GO DEEP \u2014 Full Courses")}
${p("Comprehensive, structured programmes that take you from understanding to transformation. <strong>Foundations of Self-Esteem</strong> (9 modules, ~6 hours) builds your core. <strong>Confidence from Within</strong> (10 modules, ~7.5 hours) tackles the inner critic head-on.")}
${h("GET TOOLS \u2014 Digital Worksheets & Journals")}
${p("Practical tools you can use immediately \u2014 guided journals, reframing cards, self-assessment kits, and planners designed to support your daily practice.")}
${h("GO ALL IN \u2014 1:1 Sessions with Me")}
${p('If you want personalised guidance, <a href="/book?type=free_consultation" style="color: #8BA889; font-weight: 600;">book a free 30-minute consultation</a>. We\u2019ll talk about where you are, where you want to be, and how I can help.')}
${p("There\u2019s no pressure and no wrong choice. Even continuing with these emails is a valid path. The important thing is that you keep showing up for yourself.")}
${sig}`,
  },

  onboarding_8: {
    subject: "3 Boundaries That Will Change Your Relationships",
    previewText: "Setting limits isn\u2019t selfish \u2014 it\u2019s essential...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Today I want to talk about something that comes up with almost every client I work with: <strong>boundaries</strong>.")}
${p("Most people think boundaries are about keeping others out. They\u2019re not. Boundaries are about protecting what\u2019s important to you \u2014 your energy, your time, your emotional health \u2014 so you can show up fully for the people and things that matter.")}
${p("Here are three boundaries that can transform your daily life:")}
${h("1. The Energy Boundary")}
${p('Before saying yes to any request, ask yourself: \u201CWill this energise me or drain me?\u201D You don\u2019t have to say no to everything draining \u2014 but you should be making a <strong>conscious choice</strong>, not an automatic one.')}
${h("2. The Time Boundary")}
${p('Stop treating your own needs as \u201Cwhat I\u2019ll do if there\u2019s time left over.\u201D Schedule time for yourself FIRST \u2014 even 15 minutes \u2014 and treat it as non-negotiable. You\u2019d never cancel a meeting with your boss. Don\u2019t cancel meetings with yourself.')}
${h("3. The Emotional Boundary")}
${p("<strong>You are not responsible for other people\u2019s feelings.</strong> Read that again. You can be kind, compassionate, and caring while also recognising that someone else\u2019s emotional state is not yours to fix.")}
${p("These aren\u2019t selfish acts. They\u2019re self-preservation. And they\u2019re the foundation of healthy relationships \u2014 with others and with yourself.")}
${p("Which one do you need most right now?")}
${sig}`,
  },

  onboarding_9: {
    subject: "The Confidence Myth Nobody Talks About",
    previewText: "What if everything you\u2019ve been told about confidence is wrong?",
    bodyHtml: `${p("Hi {{firstName}},")}
${p('Here\u2019s a myth that keeps people stuck: <strong>\u201CI need to feel confident before I can act confidently.\u201D</strong>')}
${p("It sounds logical. But it\u2019s completely backwards.")}
${p("Confidence doesn\u2019t come before action. It comes <strong>FROM</strong> action. You don\u2019t feel ready, then do the thing. You do the thing, survive it, and THEN feel more confident about doing it again.")}
${p("Think about the first time you drove a car. Were you confident? Absolutely not. You were terrified. But you did it anyway. And after doing it 50, 100, 500 times, it became automatic. The confidence came from the repetition, not the other way around.")}
${p('This is why \u201Cfake it till you make it\u201D is bad advice. It implies confidence is a performance. Real confidence isn\u2019t performed \u2014 it\u2019s <strong>earned through accumulated evidence</strong> that you can handle things.')}
${p("So the next time you\u2019re waiting to feel confident enough to apply for that role, have that conversation, set that boundary, or make that change \u2014 <strong>stop waiting</strong>. Act first. Feel confident later.")}
${p("The discomfort you feel isn\u2019t a sign that you\u2019re not ready. It\u2019s a sign that you\u2019re growing.")}
${sig}`,
  },

  onboarding_10: {
    subject: "Your Personal Growth Toolkit \u2014 Curated Just for You",
    previewText: "Practical tools and resources I\u2019ve handpicked for your journey...",
    ctaText: "Browse All Products",
    ctaUrl: "/courses",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("You\u2019ve been with me for almost a month now, and I\u2019ve loved sharing these insights with you. Today I want to put together a curated toolkit based on the topics we\u2019ve covered.")}
${h("FOR YOUR DAILY PRACTICE")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>Daily Affirmations & Reflection Planner</strong> \u2014 a year-long guided planner for your morning 5-minute practice</li>
<li><strong>Negative Thought Reframing Cards</strong> \u2014 30 printable cards with CBT-based reframing prompts</li>
<li><strong>Weekly Self-Care & Growth Tracker</strong> \u2014 52 weeks of tracking your habits, mood, and progress</li>
</ul>
${h("FOR DEEPER WORK")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>Self-Esteem Starter Kit</strong> \u2014 comprehensive workbook with assessments, exercises, and action plans</li>
<li><strong>Inner Critic Transformation Journal</strong> \u2014 40+ pages of guided journaling to rewrite your inner narrative</li>
</ul>
${h("FOR STRUCTURED LEARNING")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>Foundations of Self-Esteem</strong> \u2014 9-module course building your core self-worth</li>
<li><strong>Confidence from Within</strong> \u2014 10-module course on silencing the inner critic</li>
</ul>
${p("No pressure. Just options. Pick what feels right for where you are right now.")}
${sig}`,
  },

  onboarding_11: {
    subject: "What\u2019s Next? Your Journey Continues \u2014 Here\u2019s How",
    previewText: "This isn\u2019t goodbye \u2014 it\u2019s just the beginning...",
    ctaText: "Book a Free Consultation",
    ctaUrl: "/book?type=free_consultation",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("We\u2019ve been on this journey together for a month now, and I want to take a moment to say: <strong>thank you</strong>. Thank you for opening these emails, for trying the exercises, for being willing to look inward. That takes courage.")}
${p("Here\u2019s what I want you to take forward:")}
<ol style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>Self-esteem is a practice, not a destination.</strong> There\u2019s no finish line. But every day you choose to show up for yourself, you\u2019re building it.</li>
<li><strong>Your inner critic is not your enemy.</strong> It\u2019s an outdated protection system. You can acknowledge it without obeying it.</li>
<li><strong>Confidence comes from action,</strong> not the other way around. Stop waiting to feel ready. Start before you\u2019re ready.</li>
<li><strong>You deserve boundaries.</strong> Setting limits isn\u2019t selfish. It\u2019s the foundation of every healthy relationship.</li>
<li><strong>You\u2019re not alone.</strong> Whether it\u2019s through these emails, a course, a worksheet, or a 1:1 session \u2014 I\u2019m here.</li>
</ol>
${p("Going forward, you\u2019ll hear from me twice a month with fresh insights, practical tips, seasonal reflections, and occasional offers. I\u2019ll keep it valuable \u2014 I promise.")}
${p("If there\u2019s ever a specific topic you\u2019d like me to cover, just hit reply. I read every message.")}
${p("Here\u2019s to your ongoing journey.")}
<p style="margin: 24px 0 0; line-height: 1.6;">With warmth and belief in you,<br><strong>Roxanne</strong></p>
${p('<em>P.S. If you haven\u2019t explored our courses or digital products yet, there\u2019s no rush. They\u2019ll be here when you\u2019re ready. And if you ever want personalised guidance, your free 30-minute consultation is always available.</em>')}`,
  },

  // ============================================================
  // NEWSLETTER SEQUENCE (24 emails, Days 44-366)
  // ============================================================

  newsletter_0: {
    subject: "The Self-Esteem Audit: Where Do You Really Stand?",
    previewText: "5 questions that reveal more than any quiz...",
    ctaText: "Get the Confidence Self-Assessment Toolkit",
    ctaUrl: "/products/confidence-self-assessment-toolkit",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("I want to give you something today that goes deeper than a typical self-assessment. I call it the <strong>Self-Esteem Audit</strong> \u2014 five questions that reveal how you truly relate to yourself, beyond the surface.")}
${p("Grab a pen. Be honest. There are no right answers.")}
<ol style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>When something goes wrong, what\u2019s the first thing you say to yourself?</strong> (Write the exact words. Don\u2019t soften them.)</li>
<li><strong>When someone compliments you, what\u2019s your internal reaction?</strong> Do you accept it, deflect it, or immediately think of a reason it\u2019s not true?</li>
<li><strong>When you compare yourself to others, who do you compare yourself to?</strong> And do you compare their best to your worst?</li>
<li><strong>If someone asked the people closest to you to describe your strengths, what would they say?</strong> Now \u2014 do you believe those things about yourself?</li>
<li><strong>What\u2019s one thing you\u2019d attempt if you knew you couldn\u2019t fail?</strong></li>
</ol>
${p("Your answers to these questions reveal your <strong>self-esteem operating system</strong> \u2014 the invisible beliefs running in the background of every decision you make.")}
${p("If you noticed some uncomfortable patterns, that\u2019s not a problem. That\u2019s awareness. And awareness is always the first step toward change.")}
${sig}`,
  },

  newsletter_1: {
    subject: "The Hidden Cost of People-Pleasing",
    previewText: "When \u2018being nice\u2019 comes at the expense of being you...",
    ctaText: "Explore \u2018The Art of Saying No\u2019 Short Course",
    ctaUrl: "/courses/short/the-art-of-saying-no",
    bodyHtml: `${p("Hi {{firstName}},")}
${p('I had a conversation with a client recently that I keep thinking about. She told me: <strong>\u201CI\u2019m exhausted from being everyone\u2019s favourite person.\u201D</strong>')}
${p("That sentence stopped me. Because it perfectly captures what people-pleasing actually costs.")}
${p("On the surface, people-pleasing looks like kindness. But underneath, it\u2019s often driven by a deep fear: <em>if I stop being useful, I\u2019ll stop being wanted.</em>")}
${p("Here\u2019s what people-pleasing actually costs you:")}
${p("<strong>Your time.</strong> You say yes to things you don\u2019t want to do, and there\u2019s no time left for what matters to you.")}
${p("<strong>Your energy.</strong> You\u2019re so busy managing other people\u2019s emotions that you\u2019ve lost touch with your own.")}
${p("<strong>Your authenticity.</strong> People don\u2019t know the real you \u2014 they know the version of you that says what they want to hear.")}
${p("<strong>Your self-respect.</strong> Every time you abandon your own needs to meet someone else\u2019s, you\u2019re telling yourself: their comfort matters more than mine.")}
${p("The antidote isn\u2019t becoming selfish. It\u2019s learning to value your own needs <strong>equally</strong>. Not more than others. Equally.")}
${sig}`,
  },

  newsletter_2: {
    subject: "3 Signs You\u2019re Self-Sabotaging (Without Realising It)",
    previewText: "The enemy isn\u2019t out there. It\u2019s the patterns you can\u2019t see...",
    ctaText: "Explore \u2018The 5 Types of Self-Sabotage\u2019 Short Course",
    ctaUrl: "/courses/short/5-types-of-self-sabotage",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Self-sabotage is sneaky. It rarely looks like dramatically burning things down. More often, it looks like this:")}
${h("1. Procrastination disguised as preparation")}
${p('\u201CI just need to do a bit more research.\u201D \u201CI\u2019ll start once I have the right setup.\u201D If you\u2019ve been \u201Cpreparing\u201D for weeks without starting, that\u2019s not thoroughness. That\u2019s fear wearing a productivity mask.')}
${h("2. Downplaying your achievements")}
${p('Someone praises your work and you immediately point out what could have been better. You got the promotion and your first thought was \u201Cthey\u2019ll figure out I don\u2019t deserve this.\u201D You\u2019re editing out your own success story.')}
${h("3. Choosing comfort over growth")}
${p("You stay in the job that\u2019s too small, the relationship that\u2019s not right, the routine that\u2019s not working \u2014 because the discomfort of change feels bigger than the discomfort of staying stuck. But is it really?")}
${p("The thing about self-sabotage is that it always has a logic. Your brain is protecting you from something \u2014 failure, rejection, judgement, the unknown. The work isn\u2019t about forcing yourself to stop. It\u2019s about understanding <strong>WHY</strong> you do it.")}
${p("Which of these three hit closest to home? Hit reply \u2014 I\u2019d genuinely love to hear.")}
${sig}`,
  },

  newsletter_3: {
    subject: "A Letter to You on a Hard Day",
    previewText: "For when everything feels too much...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("I don\u2019t know if you\u2019re having a hard day today. But if you are, this email is for you. And if you\u2019re not, save it for when you need it.")}
${p("Here\u2019s what I want you to hear:")}
${p("<strong>You are not failing.</strong> The fact that you\u2019re struggling doesn\u2019t mean you\u2019re doing it wrong. It means you\u2019re human.")}
${p("<strong>You don\u2019t have to have it all figured out.</strong> Nobody does. The people who look like they do are usually just better at hiding their mess.")}
${p("<strong>The progress you\u2019ve made counts,</strong> even if you can\u2019t see it right now. Growth isn\u2019t always visible. Seeds grow underground before they break the surface.")}
${p("<strong>It\u2019s okay to rest.</strong> Rest isn\u2019t quitting. It\u2019s refuelling. You can\u2019t pour from an empty cup, and you don\u2019t need to prove your worth through constant productivity.")}
${p("<strong>You are worthy of kindness</strong> \u2014 especially from yourself.")}
${p('If you need support today, I\u2019m here. You can <a href="/book?type=free_consultation" style="color: #8BA889; font-weight: 600;">book a free consultation</a> just to talk things through, or simply reply to this email. You don\u2019t have to do this alone.')}
${p("Take care of yourself today. Whatever that looks like.")}
<p style="margin: 24px 0 0; line-height: 1.6;">With warmth,<br><strong>Roxanne</strong></p>`,
  },

  newsletter_4: {
    subject: "How to Stop Comparing Yourself to Everyone Online",
    previewText: "Your behind-the-scenes vs their highlight reel...",
    ctaText: "Explore \u2018The Comparison Trap\u2019 Short Course",
    ctaUrl: "/courses/short/the-comparison-trap",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Let me guess: you <em>know</em> comparison is unhealthy. You <em>know</em> Instagram isn\u2019t real. You <em>know</em> you shouldn\u2019t measure your chapter 2 against someone else\u2019s chapter 20.")}
${p("And yet.")}
${p("Here\u2019s the thing \u2014 telling yourself to \u201Cstop comparing\u201D doesn\u2019t work. Your brain is wired to compare. So instead of fighting the instinct, try <strong>redirecting</strong> it.")}
${h("Tip 1: Compare yourself to yourself")}
${p("Look at where you were 6 months ago, a year ago, five years ago. That\u2019s the only comparison that matters.")}
${h("Tip 2: Replace consumption with creation")}
${p("The most comparison-proof activity in the world is creating something. When you\u2019re in creation mode, there\u2019s nothing to compare.")}
${h("Tip 3: Curate ruthlessly")}
${p("Unfollow, mute, or hide any account that consistently makes you feel worse about yourself. This isn\u2019t weakness \u2014 it\u2019s boundary setting for your mental space.")}
${p("Your energy is too valuable to spend measuring yourself against someone else\u2019s curated reality.")}
${sig}`,
  },

  newsletter_5: {
    subject: "What I\u2019ve Learned From 500+ Coaching Sessions",
    previewText: "The patterns I see over and over (and what they teach us)...",
    ctaText: "Book a Free Consultation",
    ctaUrl: "/book?type=free_consultation",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("After hundreds of coaching sessions, certain patterns emerge. Here are four things I\u2019ve learned:")}
${p("<strong>Everyone thinks they\u2019re the only one struggling.</strong> They\u2019re not. The shame people carry is almost always amplified by the belief that \u201Ceveryone else has it together.\u201D They don\u2019t.")}
${p("<strong>The breakthrough rarely comes from learning something new.</strong> It usually comes from finally believing something you already knew. Most of my clients don\u2019t need more information. They need permission to trust what they already feel.")}
${p("<strong>Small changes compound into transformation.</strong> I\u2019ve never seen someone\u2019s life change because of one dramatic moment. I\u2019ve seen hundreds of lives change through consistent small choices.")}
${p("<strong>People are remarkably resilient when they stop fighting themselves.</strong> The energy most people spend on self-criticism, if redirected toward self-compassion, is enough to move mountains.")}
${p("If any of this resonates, know that you\u2019re in good company. The work you\u2019re doing \u2014 even just reading these emails and thinking about your patterns \u2014 matters.")}
${sig}`,
  },

  newsletter_6: {
    subject: "The Assertiveness Cheat Sheet You\u2019ll Actually Use",
    previewText: "What to say (and how to say it) when you need to speak up...",
    ctaText: "Get the Boundary-Setting Scripts Pack",
    ctaUrl: "/products/boundary-setting-scripts",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Being assertive doesn\u2019t mean being aggressive. It means expressing your needs, feelings, and boundaries clearly and respectfully.")}
${h("THE ASSERTIVENESS FORMULA")}
${p('<em>\u201CI feel [emotion] when [specific situation]. I need [what you need]. Can we [proposed solution]?\u201D</em>')}
${h("Example 1 \u2014 At work:")}
${p('<em>\u201CI feel overwhelmed when new tasks are added to my plate without discussion. I need us to prioritise together. Can we have a quick check-in before adding new projects?\u201D</em>')}
${h("Example 2 \u2014 In relationships:")}
${p('<em>\u201CI feel unheard when my suggestions are dismissed. I need to feel like my input matters. Can we make a rule that we both consider each other\u2019s ideas before deciding?\u201D</em>')}
${h("Example 3 \u2014 With family:")}
${p('<em>\u201CI feel stressed when visits are planned without checking with me first. I need some advance notice. Can we agree to confirm plans at least a week ahead?\u201D</em>')}
${p("Notice what\u2019s NOT in the formula: blame, accusations, ultimatums, or the word \u201Cyou\u201D at the start of a sentence.")}
${p("Print it out. Stick it on your fridge. Practice it in low-stakes situations first.")}
${sig}`,
  },

  newsletter_7: {
    subject: "When Growth Feels Like Going Backwards",
    previewText: "The messy middle is where the real work happens...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Can I be honest about something? Growth isn\u2019t linear.")}
${p('I call the rough patches <strong>\u201Cthe messy middle.\u201D</strong> It\u2019s the phase where the initial excitement has worn off, the old patterns haven\u2019t fully released, and the new ones haven\u2019t fully taken hold.')}
${p("This is actually the <strong>MOST important phase</strong>. Here\u2019s what I tell my clients:")}
${p("<strong>Setbacks are not evidence that it\u2019s not working.</strong> They\u2019re evidence that your brain is reorganising. Old patterns flare up on their way out.")}
${p("<strong>Lower the bar.</strong> If your goal was journaling every morning and you\u2019ve stopped, don\u2019t aim for 20 minutes. Aim for 2 minutes. Just open the notebook.")}
${p("<strong>Celebrate the micro-wins.</strong> Did you catch a negative thought and reframe it? That\u2019s growth. Did you say no to something you would have said yes to before? That\u2019s growth.")}
${p("You\u2019re not going backwards. You\u2019re in the messy middle. Keep going.")}
${sig}`,
  },

  newsletter_8: {
    subject: "5 Journal Prompts for When You Feel Stuck",
    previewText: "Sometimes the right question unlocks everything...",
    ctaText: "Get the Inner Critic Transformation Journal",
    ctaUrl: "/products/inner-critic-transformation-journal",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("When you\u2019re feeling stuck, what you actually need is a good question. Here are five I return to again and again:")}
<ol style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>\u201CWhat am I tolerating right now that I don\u2019t have to?\u201D</strong> List everything. You don\u2019t have to fix it all \u2014 just seeing it is powerful.</li>
<li><strong>\u201CIf I were giving advice to a friend in my exact situation, what would I say?\u201D</strong> Write the advice. Then read it back as if someone wrote it to you.</li>
<li><strong>\u201CWhat am I afraid will happen if I succeed?\u201D</strong> Fear of success is as common as fear of failure.</li>
<li><strong>\u201CWhat does my body need right now?\u201D</strong> Not your mind. Your body. Sleep? Movement? Stillness?</li>
<li><strong>\u201CWhat\u2019s one thing I can control in this situation?\u201D</strong> Narrowing your focus to what\u2019s within your control restores a sense of agency.</li>
</ol>
${p("Pick one. Write for 10 minutes. See what surfaces.")}
${sig}`,
  },

  newsletter_9: {
    subject: "What Nobody Tells You About Building Confidence at Work",
    previewText: "The boardroom isn\u2019t the problem. Your beliefs about yourself are...",
    ctaText: "Explore \u2018Confidence Under Pressure\u2019",
    ctaUrl: "/courses/short/confidence-under-pressure",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Professional confidence is different from personal confidence. You might feel perfectly comfortable with friends but freeze in a team meeting.")}
${p("Here are three truths about professional confidence:")}
${p("<strong>Your expertise is not the issue.</strong> Most people who lack professional confidence are actually very good at what they do. The problem isn\u2019t competence \u2014 it\u2019s the gap between what you know and what you believe you deserve.")}
${p("<strong>The loudest person in the room isn\u2019t the most confident.</strong> True professional presence is about speaking with intention, listening with depth, and being comfortable with not knowing everything.")}
${p("<strong>Negotiating your worth isn\u2019t greedy. It\u2019s essential.</strong> Every time you accept less than you\u2019re worth, you reinforce the belief that you don\u2019t deserve more.")}
${sig}`,
  },

  newsletter_10: {
    subject: "The Relationship Between Self-Esteem and Your Relationships",
    previewText: "You can\u2019t give what you don\u2019t have for yourself...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Here\u2019s something that becomes obvious once you see it: the relationship you have with yourself sets the template for every other relationship in your life.")}
${p("Low self-esteem in relationships looks like:")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li>Staying with someone who doesn\u2019t treat you well because you believe you can\u2019t do better</li>
<li>Constantly seeking reassurance that your partner still loves you</li>
<li>Avoiding conflict at all costs, even when your needs aren\u2019t being met</li>
<li>Losing yourself in the relationship \u2014 your interests, your friendships, your identity</li>
<li>Interpreting everything as rejection</li>
</ul>
${p("The instinct is to fix the relationship. But often, the real work starts with fixing how you see yourself.")}
${p("When you believe you\u2019re worthy of love and respect \u2014 not intellectually, but in your bones \u2014 you stop tolerating treatment that falls below that standard.")}
${p("This isn\u2019t about becoming selfish. It\u2019s about becoming <strong>whole</strong>.")}
${sig}`,
  },

  newsletter_11: {
    subject: "Halfway Check-In: How Are You Really Doing?",
    previewText: "Let\u2019s take stock of where you are...",
    ctaText: "Book Your Free Check-In Consultation",
    ctaUrl: "/book?type=free_consultation",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("It\u2019s been about six months since you joined this community, and I want to check in.")}
${p('Not the polite \u201Chow are you\u201D where the only acceptable answer is \u201Cfine.\u201D I mean: <strong>how are you REALLY doing?</strong>')}
${p("Take a moment. Think about where you were six months ago and where you are now:")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li>Have you noticed any shifts in how you talk to yourself?</li>
<li>Have you set any boundaries you wouldn\u2019t have set before?</li>
<li>Have you tried any of the exercises from these emails?</li>
<li>Has anything changed in how you see yourself?</li>
</ul>
${p("If the answer is yes to any of these \u2014 even slightly \u2014 that\u2019s real progress. Celebrate it.")}
${p("If the answer is \u201Cnot really\u201D \u2014 that\u2019s okay too. Sometimes you need a different approach \u2014 more structured support, personalised guidance, or a specific toolkit.")}
${p("Either way, I\u2019m here.")}
${sig}`,
  },

  newsletter_12: {
    subject: "Why \u2018Self-Care\u2019 Isn\u2019t What You Think It Is",
    previewText: "It\u2019s not bubble baths and face masks (though those are nice)...",
    ctaText: "Get the Weekly Self-Care & Growth Tracker",
    ctaUrl: "/products/weekly-self-care-growth-tracker",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Self-care has been commercialised into candles and bath bombs. But real self-care is often much less glamorous.")}
${p("<strong>Real self-care looks like:</strong>")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li>Going to bed at a reasonable hour even when Netflix is calling</li>
<li>Having the difficult conversation you\u2019ve been avoiding</li>
<li>Saying no to the social event that will drain you</li>
<li>Making the appointment you\u2019ve been putting off</li>
<li>Asking for help when you need it</li>
<li>Setting the boundary that might disappoint someone</li>
</ul>
${p("Real self-care is often <strong>uncomfortable</strong> in the moment. It\u2019s choosing long-term wellbeing over short-term ease.")}
${p('I\u2019m not against the bath bombs. But if your \u201Cself-care routine\u201D never includes the hard stuff, it\u2019s not self-care. It\u2019s self-soothing. And there\u2019s a difference.')}
${p("What\u2019s one piece of real, uncomfortable self-care you\u2019ve been avoiding? Maybe this week is the week you do it.")}
${sig}`,
  },

  newsletter_13: {
    subject: "The Power of \u2018Good Enough\u2019",
    previewText: "Perfectionism isn\u2019t a strength. It\u2019s a prison...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Perfectionism disguises itself as high standards. But here\u2019s how you know the difference:")}
${p('<strong>High standards</strong> say: \u201CI want to do my best work.\u201D<br><strong>Perfectionism</strong> says: \u201CIf it\u2019s not perfect, it\u2019s worthless.\u201D')}
${p("If perfectionism is your pattern, here are three things to practice:")}
<ol style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>Set a \u201Cgood enough\u201D threshold.</strong> Before starting any task, define what \u201Cgood enough\u201D looks like. Then stop when you hit it.</li>
<li><strong>Ship before you\u2019re ready.</strong> The gap between 90% and 100% costs 50% of your time and energy. And nobody notices except you.</li>
<li><strong>Celebrate completion over perfection.</strong> Finished beats perfect. Every time.</li>
</ol>
${p("Perfectionism is not your friend. It\u2019s fear disguised as ambition. Give yourself permission to be good enough.")}
${sig}`,
  },

  newsletter_14: {
    subject: "A Client\u2019s Story: From People-Pleaser to Self-Advocate",
    previewText: "What happens when you finally choose yourself...",
    ctaText: "Explore Our Boundary-Setting Resources",
    ctaUrl: "/courses?category=all:mental_wellness",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("I want to share a journey I\u2019ve watched unfold (with permission, details changed for privacy).")}
${p('When Sarah first came to me, she described herself as \u201Cthe person everyone calls when they need something.\u201D She wasn\u2019t unhappy, she said. She was just... <strong>tired</strong>. All the time.')}
${p("The first breakthrough came when she realised that her exhaustion wasn\u2019t from doing too much. It was from <strong>abandoning herself</strong> too much.")}
${p('We started small. One \u201Cno\u201D per week. The first one was declining a committee meeting she dreaded.')}
${p("The sky did not fall.")}
${p('Six months later, Sarah described herself differently: <strong>\u201CI\u2019m the person who shows up when it matters \u2014 including for myself.\u201D</strong>')}
${p("The thing that struck me most? Sarah said the hardest part wasn\u2019t learning to say no. It was believing she was <strong>allowed to</strong>.")}
${p("If you see yourself in Sarah\u2019s story, you\u2019re not alone. This is one of the most common patterns I work with, and it\u2019s absolutely changeable.")}
${sig}`,
  },

  newsletter_15: {
    subject: "Your Body Keeps the Score (And What to Do About It)",
    previewText: "When stress lives in your body, not just your mind...",
    ctaText: "Explore \u2018Emergency Anxiety Toolkit\u2019 Short Course",
    ctaUrl: "/courses/short/emergency-anxiety-toolkit",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("You know that tension in your shoulders that never fully goes away? The tight jaw you notice at 3pm? That\u2019s your nervous system storing what your mind hasn\u2019t processed.")}
${p("Here are three nervous system regulation techniques you can use anywhere:")}
${h("1. The Physiological Sigh")}
${p("Two quick inhales through your nose, then one long exhale through your mouth. Repeat 2-3 times. This activates your parasympathetic nervous system within seconds.")}
${h("2. The 5-4-3-2-1 Grounding Exercise")}
${p("Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. This pulls your brain out of the stress loop.")}
${h("3. Gentle Bilateral Movement")}
${p("Walk, tap alternate knees, or shift your weight from foot to foot. Bilateral movement helps both sides of the brain process stress.")}
${p("Your body is your ally. Learn to listen to what it\u2019s telling you.")}
${sig}`,
  },

  newsletter_16: {
    subject: "How to Have the Conversation You\u2019ve Been Avoiding",
    previewText: "A step-by-step guide for when \u2018we need to talk\u2019...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("We all have one. That conversation we know we need to have but keep putting off.")}
${h("BEFORE the conversation:")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li>Get clear on your <strong>ONE key point</strong>. Not five grievances. One thing.</li>
<li>Write it down using the assertiveness formula: \u201CI feel... when... I need... Can we...\u201D</li>
<li>Decide what outcome you want.</li>
</ul>
${h("DURING the conversation:")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li>Lead with vulnerability, not accusation. \u201CThis is hard for me to say\u201D is disarming.</li>
<li>Stick to your ONE point.</li>
<li>Listen without planning your response. Actually listen.</li>
<li>It\u2019s okay to say: \u201CI need a moment to think about that.\u201D</li>
</ul>
${h("AFTER the conversation:")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li>Don\u2019t replay it endlessly. You said what you needed to say.</li>
<li>Give the other person space to process.</li>
<li>Be proud of yourself for showing up.</li>
</ul>
${p("The conversation you\u2019re avoiding is probably the one you most need to have.")}
${sig}`,
  },

  newsletter_17: {
    subject: "What I Wish I\u2019d Known at 25 (and 35, and Yesterday)",
    previewText: "Some lessons you learn over and over...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("I\u2019ve been reflecting on the lessons that keep reappearing in my life. Here are a few:")}
${p("<strong>Saying no gets easier with practice.</strong> It never becomes effortless. But the guilt gets shorter, the relief gets quicker, and the results get clearer.")}
${p("<strong>Not everyone will understand your growth.</strong> And that\u2019s okay. Some people loved the version of you that didn\u2019t have boundaries.")}
${p("<strong>Rest is not laziness.</strong> Pushing through exhaustion isn\u2019t admirable. It\u2019s expensive \u2014 in health, in relationships, in quality of work.")}
${p("<strong>The things you\u2019re most afraid of saying are usually the things that need saying most.</strong>")}
${p("<strong>You\u2019re allowed to change your mind.</strong> Consistency is overrated when it means staying committed to something that no longer serves you.")}
${p("<strong>Asking for help is strength, not weakness.</strong> Building a life you love doesn\u2019t mean building it alone.")}
${p("Which of these resonates most for you today?")}
${sig}`,
  },

  newsletter_18: {
    subject: "How to Deal with Someone Who Doesn\u2019t Respect Your Boundaries",
    previewText: "When they push back, here\u2019s what to do...",
    ctaText: "Explore \u2018Handling Boundary Pushback\u2019 Short Course",
    ctaUrl: "/courses/short/handling-boundary-pushback",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Setting a boundary is one thing. Maintaining it when someone pushes back is another entirely.")}
${p("When someone pushes back on your boundary:")}
<ol style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>Acknowledge their feelings without abandoning your position.</strong> \u201CI understand this is frustrating for you, and I need to stick with this.\u201D</li>
<li><strong>Don\u2019t over-explain.</strong> \u201CI\u2019m not available for that\u201D is a complete sentence.</li>
<li><strong>Use the broken record technique.</strong> Calmly repeat your boundary. Don\u2019t escalate. Just repeat.</li>
<li><strong>Accept the discomfort.</strong> Their displeasure is not your emergency.</li>
<li><strong>Evaluate the relationship.</strong> If someone consistently disrespects your boundaries, that\u2019s not a boundary problem. That\u2019s a relationship problem.</li>
</ol>
${p("Your boundaries aren\u2019t negotiable. And the people who truly care about you will respect them.")}
${sig}`,
  },

  newsletter_19: {
    subject: "The Gift of Being a Highly Sensitive Person",
    previewText: "What if your sensitivity isn\u2019t a weakness?",
    ctaText: "Get Notified When The Empowered Empath Launches",
    ctaUrl: "/courses/the-empowered-empath",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("About 15-20% of the population is considered a Highly Sensitive Person (HSP). If you feel things deeply, get overwhelmed by stimulation, or absorb the emotions of people around you \u2014 you might be one of them.")}
${p('For most of my HSP clients, sensitivity has always felt like a liability. They\u2019ve been told they\u2019re \u201Ctoo sensitive\u201D or \u201Ctoo emotional.\u201D')}
${p("But here\u2019s what I\u2019ve seen over and over: <strong>sensitivity, properly managed, is a superpower.</strong>")}
${p("HSPs make exceptional leaders. They\u2019re natural empaths. They notice things others miss. They care deeply about quality, ethics, and impact.")}
${p("The challenge isn\u2019t the sensitivity itself. It\u2019s the lack of tools to manage it.")}
${p("When you learn to protect your energy, set boundaries, and distinguish your emotions from others\u2019 \u2014 sensitivity becomes your greatest asset.")}
${p("This is exactly what our <strong>Empowered Empath</strong> course is designed for. Reply to this email and I\u2019ll make sure you\u2019re the first to hear when it launches.")}
${sig}`,
  },

  newsletter_20: {
    subject: "A Simple Framework for Making Hard Decisions",
    previewText: "When you\u2019re stuck between options, try this...",
    ctaText: "Get the Values Discovery Workbook",
    ctaUrl: "/products/values-discovery-workbook",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("Decision paralysis \u2014 we\u2019ve all been there. Here\u2019s a framework for when a decision feels impossible:")}
${h("THE 10-10-10 RULE")}
${p("Ask yourself: How will I feel about this decision in <strong>10 minutes</strong>? In <strong>10 months</strong>? In <strong>10 years</strong>? This separates short-term discomfort from long-term impact.")}
${h("THE VALUES CHECK")}
${p("List your top 3 personal values. Now ask: which option aligns better? When a decision aligns with your values, it might still be hard \u2014 but it won\u2019t feel wrong.")}
${h("THE BODY CHECK")}
${p("Close your eyes. Imagine you\u2019ve chosen Option A. Notice what your body does. Tension? Relief? Now do the same with Option B.")}
${p("Your body often knows before your brain does. Gut feeling isn\u2019t mystical \u2014 it\u2019s your nervous system processing information your conscious mind hasn\u2019t caught up with.")}
${p("<strong>You already know what to do. Trust yourself.</strong>")}
${sig}`,
  },

  newsletter_21: {
    subject: "Why You Don\u2019t Need to \u2018Fix\u2019 Yourself",
    previewText: "You\u2019re not broken. Here\u2019s what you are...",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("I want to challenge something today. The idea that you need to be \u201Cfixed.\u201D")}
${p("<strong>You don\u2019t.</strong>")}
${p("You\u2019re not broken. You\u2019re a human being who has been shaped by experiences, some of which taught you things that are no longer serving you. The critical self-talk? It was taught. The people-pleasing? It was learned. The self-doubt? It was conditioned.")}
${p("None of these things are flaws in your character. They\u2019re <strong>adaptations</strong> that made sense at the time and have outlived their usefulness.")}
${p("The work isn\u2019t about fixing. It\u2019s about <strong>updating</strong>. Like upgrading software that was written for an older operating system. The code isn\u2019t bad \u2014 it just needs to be rewritten for who you are now.")}
${p("You\u2019re not broken. You\u2019re evolving. And that\u2019s an entirely different thing.")}
<p style="margin: 24px 0 0; line-height: 1.6;">With warmth and belief in you,<br><strong>Roxanne</strong></p>`,
  },

  newsletter_22: {
    subject: "Your Growth This Year \u2014 A Celebration",
    previewText: "Look at how far you\u2019ve come...",
    ctaText: "Retake Your Free Self-Esteem Snapshot",
    ctaUrl: "/free/self-esteem-snapshot",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("You\u2019ve been part of this community for almost a year now, and I want to celebrate that.")}
${p("Not because you should have achieved some specific milestone. But because <strong>you\u2019ve been showing up</strong>. Opening these emails. Thinking about your patterns. Considering new perspectives.")}
${p("That matters. More than you might think.")}
${p("I invite you to take 10 minutes and answer this question:")}
${p("<strong>What\u2019s one thing that\u2019s different about how I relate to myself compared to a year ago?</strong>")}
${p("Write it down. Don\u2019t overthink it. Whatever comes to mind is the right answer.")}
${p("If you\u2019d like to take a deeper look at where you are now, download a fresh copy of the Self-Esteem Snapshot and compare your scores to when you first took it. The difference might surprise you.")}
${p("I\u2019m proud of you. Genuinely.")}
${sig}`,
  },

  newsletter_23: {
    subject: "What\u2019s Next? Your Second Year Starts Here",
    previewText: "This isn\u2019t an ending. It\u2019s a new beginning...",
    ctaText: "Explore All Courses & Products",
    ctaUrl: "/courses",
    bodyHtml: `${p("Hi {{firstName}},")}
${p("A year of these emails. Thank you for being here for every one of them.")}
${p("As we move into a new year of your growth journey, I want to share what\u2019s ahead:")}
<ul style="margin: 0 0 16px; padding-left: 24px; line-height: 1.8;">
<li><strong>New courses</strong> launching throughout the year \u2014 covering stress management, relationships, imposter syndrome, and more.</li>
<li><strong>New digital tools and resources</strong> \u2014 we\u2019re always creating practical tools to support your practice.</li>
<li><strong>Ongoing community</strong> \u2014 these emails will continue with fresh content and seasonal reflections.</li>
<li><strong>Personalised support</strong> \u2014 1:1 sessions are always available.</li>
</ul>
${p("Here\u2019s my invitation for this year: choose <strong>ONE area</strong> to go deeper in. Not everything at once. One thing.")}
${p("Pick it. Commit to it. And let me support you through it \u2014 whether that\u2019s through a course, a digital tool, or a conversation.")}
${p("You\u2019ve built the foundation. Now let\u2019s build on it.")}
${p("Here\u2019s to your next chapter.")}
<p style="margin: 24px 0 0; line-height: 1.6;">With warmth, gratitude, and excitement for what\u2019s ahead,<br><strong>Roxanne</strong></p>
${p('<em>P.S. If you know someone who would benefit from these emails, forward this to them. They can sign up for their own free Self-Esteem Snapshot and join the community at <a href="/" style="color: #8BA889; font-weight: 600;">life-therapy.co.za</a>.</em>')}`,
  },
};

export default dripEmailDefaults;
