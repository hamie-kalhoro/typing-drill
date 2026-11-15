// All practice content. Plain ASCII punctuation only, so every character is typeable.

const WORD_GROUPS = {
  long: {
    name: "Lambe Words",
    hint: "Hath ruk jata hai",
    words: ["automatically", "unfortunately", "responsibilities", "environment", "development",
            "experience", "understanding", "communication", "extraordinary", "characteristics"]
  },
  double: {
    name: "Double Letters",
    hint: "Sab se zyada galti isi me hoti hai",
    words: ["accuracy", "successfully", "necessary", "embarrassing", "accommodation",
            "occurrence", "tomorrow", "professional", "committee", "challenge"]
  },
  confusing: {
    name: "Confusing Words",
    hint: "Dimagh sochta hai",
    pairs: [["their", "there"], ["your", "you're"], ["then", "than"], ["receive", "deceive"],
            ["separate", "desperate"], ["affect", "effect"], ["through", "though"], ["quiet", "quite"]]
  },
  hard: {
    name: "Mushkil Test Words",
    hint: "Test me sab se zyada aane wale",
    words: ["rhythm", "conscience", "questionnaire", "bureaucracy", "entrepreneur",
            "handkerchief", "silhouette", "camouflage", "judgment", "maneuver"]
  }
};
WORD_GROUPS.confusing.words = WORD_GROUPS.confusing.pairs.flat();

// Daily 10 sets (confusing pairs split into two sets of 4 pairs).
const DAILY_SETS = [
  { name: "Lambe Words", words: WORD_GROUPS.long.words },
  { name: "Double Letters", words: WORD_GROUPS.double.words },
  { name: "Confusing Words (1)", words: WORD_GROUPS.confusing.pairs.slice(0, 4).flat() },
  { name: "Confusing Words (2)", words: WORD_GROUPS.confusing.pairs.slice(4).flat() },
  { name: "Mushkil Test Words", words: WORD_GROUPS.hard.words }
];

const STORIES = [
  {
    title: "10 Min. SSC CHSL Style Typing Test (35 WPM pass limit)",
    text: `In the last two decades, technology has changed the way citizens interact with the
government. Not long ago, a simple task such as paying an electricity bill or applying for a
certificate meant standing in a long queue for hours. Today many of these services are available
online, and a person can complete them from home with a mobile phone. This change has saved time,
reduced paperwork, and made public services more transparent. One of the most important benefits
of digital services is transparency. When an application is submitted online, it receives a
reference number, and the applicant can track its status at any time. This reduces the chances of
delay and discourages corruption, because every step is recorded. Officers also find it easier to
manage their work, since files no longer get lost in cupboards or move slowly from one desk to
another. Digital payments have also become very common. Small shopkeepers, vegetable sellers, and
taxi drivers now accept payments through their phones. This has made daily life convenient and has
brought millions of people into the formal banking system. At the same time, it has created a new
responsibility for citizens. They must learn to protect their passwords, avoid sharing one time
codes with strangers, and stay alert against online fraud. However, technology alone cannot solve
every problem. A large number of people in villages and small towns still do not have reliable
internet access. Many elderly citizens are not comfortable using smartphones, and some people
cannot read the instructions written on websites. If public services move online without
considering these people, they may be left behind. Therefore the government must continue to
provide help desks, training programmes, and services in local languages. Education plays a key
role in this process. Schools and colleges should teach students basic computer skills, including
typing, safe browsing, and the correct use of email. A young person who can type quickly and
accurately has a clear advantage in competitive examinations and in the job market. In conclusion,
technology is a powerful tool for good governance, but its success depends on how wisely and fairly
it is used. When every citizen has access, knowledge, and confidence, the true benefits of a
digital nation can be enjoyed by all.`
  },
  {
    title: "A Bright Future: Girls Who Lead",
    text: `In a small village near the river, a fourteen year old girl named Priya noticed that the
solar lamps in her school kept failing during the rainy season. Instead of waiting for someone from
the city, she borrowed a book on basic electronics from the library and spent her evenings learning
how the lamps worked. Within a month she had repaired every lamp in the school, and soon her
neighbours were bringing their own lamps to her door. Today she teaches a weekend class for other
girls who want to learn the same skills. Far away in a crowded city, Ayesha practiced cricket in a
narrow lane with a plastic bat and a taped ball. People laughed and told her that cricket was not a
game for girls. She ignored them and kept practicing every morning before school. Her hard work
paid off when she was selected for the state team, and now the same people who laughed at her
gather around the television to watch her matches. Meena, the daughter of a tailor, had never seen
a computer until she was fifteen. A free coding camp in her town changed her life. She stayed after
class, typed every line of code twice, and asked questions until she understood. Two years later
she built a simple mobile app that helps tailors in her market keep track of orders and payments.
These girls do not have superpowers from comic books. Their real power is curiosity, courage, and
the habit of working a little every day. When girls are given the chance to learn and lead, they do
not only change their own future. They light the way for everyone who walks behind them.`
  },
  {
    title: "Aiming High: Empowering Girls",
    text: `Empowering girls is one of the most effective ways to build a strong and healthy society.
When a girl goes to school, she gains much more than the ability to read and write. She learns to
think for herself, to ask questions, and to make decisions about her own life. Studies from many
countries show that educated women tend to marry later, have healthier families, and earn higher
incomes. They are also more likely to send their own children to school, which creates a cycle of
progress that continues for generations. Yet in many places, girls still face serious obstacles.
Some must walk long distances to reach the nearest school. Others are kept at home to help with
household work or to look after younger brothers and sisters. In some families, the education of a
son is seen as an investment, while the education of a daughter is seen as a cost. These attitudes
must change if a nation wants to use the full talent of its people. Simple steps can make a large
difference. Safe transport, clean toilets in schools, scholarships, and free bicycles have helped
millions of girls stay in class. Female teachers and role models show young girls that they too can
become doctors, engineers, pilots, and leaders. Parents play the most important role of all. A
father who says to his daughter, "You can be anything you want," gives her a gift that no money can
buy. Empowering girls is not a favour to them. It is a wise choice for every family, every village,
and every country that dreams of a brighter tomorrow.`
  },
  {
    title: "Aesop's Fables (retold)",
    text: `The Fox and the Grapes. One warm afternoon a hungry fox walked through an orchard and saw a
bunch of ripe purple grapes hanging from a high branch. He jumped as high as he could, but he missed.
He stepped back, ran, and jumped again, but the grapes were still out of reach. After many tries he
gave up and walked away with his nose in the air. "Those grapes are probably sour anyway," he said.
It is easy to dislike what we cannot have. The Tortoise and the Hare. A proud hare once laughed at a
tortoise for being so slow. The tortoise calmly challenged him to a race. The hare shot ahead and was
soon so far in front that he decided to take a nap under a shady tree. Meanwhile the tortoise kept
walking, one slow step after another, without stopping. When the hare finally woke up, he saw the
tortoise crossing the finish line. Slow and steady wins the race. The Boy Who Cried Wolf. A young
shepherd boy grew bored while watching his sheep near the village. To have some fun, he shouted,
"Wolf! Wolf!" The villagers came running with sticks, but there was no wolf, and the boy laughed at
them. He played the same trick a few days later. Then one evening a real wolf came out of the forest.
The boy screamed for help, but this time nobody came, because nobody believed him. A liar is not
believed even when he tells the truth.`
  },
  {
    title: "Astronauts",
    text: `An astronaut is a person who is trained to travel and work in space. The first human to
reach space was Yuri Gagarin, who orbited the Earth in 1961. Eight years later, Neil Armstrong and
Buzz Aldrin walked on the surface of the Moon, and the world watched in wonder. Since then, hundreds
of men and women from many countries have flown into space. Becoming an astronaut is not easy.
Candidates usually have a strong background in science, engineering, medicine, or flying. Training
can take several years. Astronauts practice spacewalks in giant swimming pools, learn to repair
complex equipment, study the languages of their international partners, and spend long hours in
simulators that copy every stage of a mission. Life on the International Space Station is very
different from life on Earth. The station circles the planet about every ninety minutes, so the crew
sees around sixteen sunrises and sunsets every day. Because everything floats, astronauts sleep in
sleeping bags tied to the wall, drink from special pouches, and use a carefully designed toilet. In
weightlessness, muscles and bones become weaker, so astronauts exercise for about two hours every
day on a treadmill, a bicycle, and a special weight machine. Their work includes scientific
experiments on plants, materials, and the human body, as well as regular maintenance of the station.
Many astronauts say that the most powerful moment of their journey is looking back at the Earth. From
space there are no borders, only a fragile blue planet floating in darkness. That view reminds them
that all of us share one home and must take care of it together.`
  },
  {
    title: "Behind the Scenes: Movie Credits",
    text: `When a movie ends, most people stand up and leave while a long list of names rolls slowly
up the screen. Yet every name in those credits belongs to a person who helped bring the story to
life. The director leads the creative vision of the film and guides the actors in every scene. The
producer finds the money, hires the team, and makes sure the project stays on schedule and within
budget. The screenwriter creates the story, the characters, and the dialogue long before the first
camera is switched on. The cinematographer, also called the director of photography, decides how
each shot will look, choosing the lenses, the camera angles, and the lighting. Working with this
person is the gaffer, the chief electrician, whose assistant is known by the curious title of best
boy. The grips build and move the heavy equipment that holds cameras and lights in place. After
filming is complete, the editor spends months cutting thousands of hours of footage into a story
that flows smoothly. Sound designers and foley artists create everyday noises such as footsteps,
breaking glass, and rustling clothes, often using surprising objects in a quiet studio. The composer
writes music that tells the audience when to feel excited, afraid, or sad. Costume designers, makeup
artists, set builders, and visual effects teams all add their own magic. Next time you watch a film,
stay for the credits. Each name is a small thank you to someone whose hard work you enjoyed without
even noticing.`
  },
  {
    title: "DNA Research: The Human Genome Project",
    text: `Every living cell carries a set of instructions that tells it how to grow, work, and
repair itself. These instructions are written in a molecule called DNA, which is shaped like a
twisted ladder known as a double helix. The rungs of the ladder are made of four chemical bases:
adenine, thymine, cytosine, and guanine, usually written as A, T, C, and G. The order of these
letters forms a code, much like the letters of a long book. The complete set of DNA in a human being
is called the human genome. It contains about three billion pairs of bases. In 1990, scientists from
several countries began an ambitious international effort called the Human Genome Project. Their goal
was to read the entire sequence of human DNA and to identify the genes it contains. Many experts
expected the work to take decades, but advances in computers and laboratory machines made it much
faster than planned. In 2003 the project announced that the sequence was essentially complete. One
surprising discovery was that humans have only around twenty thousand genes that make proteins, far
fewer than many scientists had predicted. The results of the project have changed medicine and
biology. Doctors can now test for many inherited diseases, researchers can study how cancer cells
change, and new medicines can be designed to target specific genes. At the same time, this knowledge
raises important questions about privacy and fairness. Who should be allowed to see a person's
genetic information, and how should it be used? As research continues, society must make sure that
the power of the genome is used responsibly and for the benefit of all people.`
  },
  {
    title: "Fairy Tales: The Emperor's New Clothes (retold)",
    text: `Long ago there lived an emperor who cared about nothing as much as his clothes. He changed
his coat every hour and spent most of the kingdom's money on fine silk and gold buttons. One day two
clever tricksters arrived in the city. They told everyone that they could weave a magical cloth so
beautiful that it was invisible to anyone who was foolish or unfit for his job. The emperor was
delighted. "With such clothes, I will know which of my ministers are wise," he thought, and he paid
the weavers a large bag of gold. The tricksters set up two empty looms and pretended to work day and
night. When the emperor sent his oldest minister to check on them, the poor man saw nothing at all.
Afraid of being called a fool, he praised the colours and the patterns. Other officials did the same.
At last the emperor went to see the cloth himself. He saw nothing, but he could not admit it in front
of his court, so he declared the cloth magnificent. On the day of the grand parade, the weavers
pretended to dress him in the new suit, and the emperor marched proudly through the streets. The
crowd cheered loudly, for no one wanted to look foolish. Then a small child pointed and shouted, "But
he has nothing on!" The words spread through the crowd until everyone was laughing. The emperor felt
his face turn red, but he held his head high and kept walking until the parade was over. Sometimes it
takes the honest voice of a child to say what everyone else is afraid to admit.`
  },
  {
    title: "The Thirsty Crow",
    text: `It was a hot summer day, and a crow was flying over the fields in search of water.
The sun was burning, and the poor bird felt weak and tired. At last he saw a clay pot
under a tree near a small house. He flew down quickly, but there was only a little water
at the bottom of the pot, and his beak could not reach it. The crow did not give up. He
looked around and saw some small stones lying on the ground. He had an idea. He picked up
one stone and dropped it into the pot. Then he dropped another, and another. Slowly the
water began to rise. After a long time the water came up near the top of the pot. The crow
drank happily and flew away to his nest. Where there is a will, there is a way.`
  },
  {
    title: "The Lion and the Mouse",
    text: `A big lion was sleeping in the forest when a little mouse ran across his face. The lion
woke up with an angry roar and caught the mouse under his heavy paw. "Please let me go,"
cried the mouse. "One day I may be able to help you." The lion laughed at the idea, but he
was in a good mood, so he lifted his paw and let the mouse run away. A few days later, the
lion was caught in a hunter's net. He pulled and roared, but the ropes only became tighter.
The little mouse heard the noise and came running. He began to bite the ropes with his
sharp teeth. Soon the net was broken, and the lion was free. The lion thanked his small
friend. From that day on, he never laughed at anyone for being small. A kind act is never
wasted, and even the smallest friend can be a great help.`
  },
  {
    title: "The Honest Woodcutter",
    text: `A poor woodcutter lived near a river at the edge of a forest. Every morning he cut wood
and sold it in the town to feed his family. One day, while he was working near the water,
his old iron axe slipped from his hand and fell into the deep river. He sat down on the bank
and began to cry, because the axe was all he had. Suddenly a kind spirit came out of the
water. She held up a golden axe and asked, "Is this your axe?" The woodcutter shook his
head. She brought up a silver axe, and again he said no. At last she showed him the old
iron axe, and he smiled and said, "Yes, that one is mine." The spirit was pleased with his
honesty and gave him all three axes as a reward. Honesty is always the best policy.`
  },
  {
    title: "A Rainy Day",
    text: `When I woke up this morning, the sky was dark and grey. Soon the first drops of rain
began to fall on the window, and within a few minutes the street was full of water. The
children in our lane ran outside to make paper boats, and their laughter filled the air.
My mother made hot tea and fried snacks, and the whole family sat together near the window.
We talked about old times and watched the rain fall on the trees. The air smelled of wet
earth, which is one of my favourite smells in the world. In the evening the rain stopped,
and a bright rainbow appeared over the hills. I went for a short walk and enjoyed the cool
breeze. A rainy day can be slow and simple, but it often brings the best memories.`
  },
  {
    title: "The Village Fair",
    text: `Once a year a big fair comes to our village, and everyone waits for it with great
excitement. Long rows of shops are set up in the open field near the old school. You can
buy colourful toys, glass bangles, clay pots, and sweet treats of every kind. There is a
giant wheel that goes so high that you can see the whole village from the top. Farmers bring
their best cows and goats, and a prize is given for the healthiest animal. In the evening,
singers and dancers perform on a small stage, and the crowd claps along with the music. My
little brother always spends all his money in the first hour, and then he asks me for more.
When we walk home under the stars, tired and happy, we are already thinking about next year.`
  },
  {
    title: "My First Job",
    text: `I still remember the morning of my first job. I woke up early, wore my best shirt, and
reached the office twenty minutes before time. My heart was beating fast as I entered the
building. The manager was a calm and friendly man. He showed me my desk, introduced me to
the team, and gave me a list of simple tasks. My first task was to type a long report. I was
slow, and I made many mistakes. A senior colleague sat with me and showed me how to keep my
fingers on the home row and look at the screen instead of the keyboard. I practiced every
evening for a month. Slowly my speed improved, and my mistakes became fewer. That first job
taught me that skill does not come in a day. It comes from patience and daily practice.`
  }
];

STORIES.forEach((s, i) => { s.group = i < 8 ? "Exam & Topic Passages" : "Classic Stories"; });

// Punctuation-heavy passages: exclamations, quotation marks, questions, apostrophes,
// colons, semicolons, hyphens and brackets. Harder than plain prose.
const PUNCT_STORIES = [
  {
    title: "The Surprise Party!",
    text: `"Shh! She's coming!" whispered Rohan, switching off the lights. Everyone froze behind the
sofa. The door creaked open, and Neha stepped inside. "Hello? Why is it so dark in here?" she asked.
Click! The lights came on, and twenty voices shouted, "SURPRISE!" Neha screamed, dropped her bag,
and then burst out laughing. "You people are crazy! How did you plan all this without telling me?"
Her brother grinned. "It wasn't easy; you check my phone every five minutes!" There were balloons
on the ceiling, a chocolate cake on the table, and a big banner that read: "Happy 18th, Neha!" Her
best friend Sara hugged her and said, "Make a wish, quickly, before the candles melt!" Neha closed
her eyes, thought for a moment, and blew. Whoosh! Every candle went out at once. "What did you wish
for?" asked Rohan. "If I tell you, it won't come true," she replied with a wink. The music started,
the cake was cut (a little unevenly), and the party went on until midnight. It was, in Neha's own
words, "the best night ever!"`
  },
  {
    title: "At the Railway Station",
    text: `"Excuse me, sir! Is this the platform for the Lahore Express?" asked an old man, holding a
heavy suitcase. The ticket checker looked at his watch. "No, uncle; that's platform 4, across the
bridge. You'll have to hurry, though: it leaves in ten minutes!" The old man's face fell. "Ten
minutes? With this bag and my bad knee?" A young student who was standing nearby stepped forward.
"Don't worry, uncle. Let me carry it for you." Together they climbed the stairs, step by step. "What's
your name, son?" asked the old man, breathing heavily. "Bilal," said the student. "And where are you
going?" "Nowhere today! I only came to buy a ticket for next week." They reached platform 4 just as
the guard blew his whistle. "Quick! Coach B-7, seat 32," Bilal said, pushing the suitcase through the
door. The old man turned and smiled. "Thank you, beta. May you always reach your destination on
time!" The train pulled away, and Bilal waved until it disappeared. He had missed his own bus home,
but somehow he didn't mind at all.`
  },
  {
    title: "Words to Live By: Famous Quotations",
    text: `Every morning, our English teacher wrote one famous quotation on the board, and we had to
type it ten times without a mistake. On Monday it was: "Arise, awake, and stop not till the goal is
reached." (Swami Vivekananda). On Tuesday, she chose something shorter: "Knowledge is power." (Francis
Bacon). "Short doesn't mean easy!" she warned us; "watch the full stop inside the quotation marks."
Wednesday's line made the whole class smile: "Well done is better than well said." (Benjamin
Franklin). On Thursday we typed: "The journey of a thousand miles begins with a single step." (Lao
Tzu). Ali asked, "Ma'am, why do we need to practice quotes at all?" She replied, "Because exam
passages are full of them! Quotation marks, commas, apostrophes; every symbol counts." On Friday, she
gave us two: "Imagination is more important than knowledge." (Albert Einstein) and "Energy and
persistence conquer all things." (Benjamin Franklin). By Saturday, our fingers knew exactly where the
quotation mark lived on the keyboard. Our teacher's final quote was her own: "Practice daily; speed
will follow!" We laughed, but we never forgot it.`
  },
  {
    title: "The Job Interview",
    text: `The interviewer looked up from her notes. "Good morning, Mr. Khan. Please, have a seat."
"Thank you, ma'am!" said Imran, trying to hide his nervous smile. "Let's begin. Why do you want to
join our company?" Imran took a deep breath. "Because your team values accuracy, discipline, and
growth; those are the qualities I've worked hard to build." She nodded. "Good answer. What's your
typing speed?" "Forty-five words per minute, with ninety-seven percent accuracy." "Impressive! How
did you reach that level?" "Honestly? Thirty minutes of practice every single day, for six weeks. No
excuses, no holidays!" She raised an eyebrow. "Not even on Sundays?" "Especially on Sundays, ma'am:
that's when I had the most free time!" She laughed. "Here's a small test, then. Type this paragraph
in five minutes." Imran's fingers flew across the keyboard; tap-tap-tap, space, tap-tap. When the
timer beeped, the screen showed 47 WPM and 98% accuracy. "Well, Mr. Khan," she said, closing her
file, "when can you start?" Imran couldn't believe his ears. "Tomorrow? Today? Right now, if you
like!"`
  },
  {
    title: "Last Over Thriller!",
    text: `What a match this has been, ladies and gentlemen! Twelve runs needed from the final over,
and the crowd is on its feet. Here comes the bowler... and it's a full toss! Smashed! That's four
runs! Eight needed from five balls now. "Come on, boys!" shouts the captain from the boundary. Next
ball: a sharp yorker; dug out for a single. Seven from four. Oh, what's this? The batsman steps out,
swings hard, and... it's high in the air! Is it going to carry? YES! That's six! Six runs! The
stadium has exploded! One run needed from three balls. The fielders are moving in; every single one
of them is inside the circle. The bowler runs in, it's a slower ball, the batsman pushes it toward
cover, and they're running! Will the throw hit the stumps? It misses! They're home! They've done it!
What a finish! "Unbelievable!" screams the commentator next to me. "I've never seen anything like
it!" The players are hugging, the fans are dancing, and somewhere in the stands, a little boy is
holding a sign that reads: "Never give up!" Today, nobody did.`
  },
  {
    title: "A Letter to My Younger Self",
    text: `Dear Me (age 15), I know you're worried right now; you think you're too slow, too
careless, and too far behind everyone else. Listen: you're not. You simply haven't started yet!
Here's what I wish someone had told me: first, accuracy comes before speed, always. Second, ten
minutes a day is better than two hours on a Sunday. Third, don't look at the keyboard! Your fingers
know more than you think. Remember the day you misspelled "receive" in front of the whole
class? Everyone laughed, didn't they? It felt like the end of the world. Guess what? Nobody
remembers it now; only you do. Mistakes aren't failures: they're lessons with a funny sound effect.
You'll fail your first typing test (34 WPM; the pass mark is 35!). You'll cry a little, eat too much
ice cream, and then you'll practice harder than ever. Six weeks later, you'll hit 46 WPM, and the
examiner will say, "Excellent work!" So, keep going. Be patient, be steady, and be kind to yourself.
With love and a lot of pride, Your Future Self. P.S. Sit up straight!`
  }
];

const TOUGH_STORIES = [
  {
    title: "The Long Road (Lambe Words)",
    text: `Unfortunately, the lights in the new office did not turn on automatically. Sara had many
responsibilities, and the working environment was cold and dark. She had years of experience
in software development, but nobody showed any understanding of her problem, because good
communication was missing. One morning she wrote a short note to the manager. She explained
that a bright and clean environment would help the whole team work better. To her surprise,
he replied within an hour. He called her idea extraordinary and said that it showed the
characteristics of a true leader. By the next week the lights switched on automatically, the
heaters were fixed, and the team felt happy again. Sara learned that clear communication and
a little patience can solve problems that seem very large. Her responsibilities did not get
smaller, but her understanding of people grew every day, and that experience became the best
part of her development.`
  },
  {
    title: "Double Trouble (Double Letters)",
    text: `Ali wanted to pass his typing test tomorrow. He knew that speed was good, but accuracy
was necessary. Last month he had made an embarrassing mistake in front of the whole committee
when he typed the word accommodation with a missing letter. Since that occurrence he practiced
every evening. He typed accommodation, committee, and occurrence again and again until the
challenge no longer scared him. His teacher, a professional typist, told him, "Accuracy first,
speed later. If you type the double letters successfully, the speed will come by itself." Ali
followed this advice. He wrote necessary ten times, then embarrassing ten times, then
successfully ten times. The next day he sat for the test and finished it successfully with no
errors. The committee was impressed. It was not luck. It was the result of small and necessary
practice every day. Now Ali tells his friends that every challenge looks big until you face it,
and that tomorrow belongs to those who prepare today.`
  },
  {
    title: "Which One Is Right? (Confusing Words)",
    text: `My friends left their bags over there and went to the park. "Is that your bag?" asked
Ahmed. "No, you're looking at Bilal's bag," I said. We walked through the gate, even though it
was getting late. The park was quiet, and the air was quite cool. We sat down on the grass and
then started to talk about the exam. Bilal said that typing was harder than maths. I told him
not to deceive himself. "If you practice, you will receive good marks," I said. "Do not separate
speed from accuracy, and do not become desperate when you make mistakes." Bad habits affect
your speed, but steady practice has a great effect on your result. Their faces looked happier
then. Though the sun was going down, we stayed there a little longer than we planned. It was
quite a quiet evening, and I think it was better than any lesson we had that week.`
  },
  {
    title: "The Stranger at Night (Mushkil Words)",
    text: `Bilal was an entrepreneur who loved music and rhythm. One night, after a long day of
fighting bureaucracy at the tax office, he saw a strange silhouette standing near his shop. It
was a tall man in a dark coat with a camouflage bag on his back. The man held out a white
handkerchief and a long questionnaire. "Please fill this in," he said. "It is for a new
business award." Bilal was careful. His conscience told him to read every line before he signed
anything. He used good judgment and checked the questions one by one. The questionnaire was
real, and the man was an officer from the city council. With a quick maneuver, Bilal moved his
car out of the narrow lane so the officer could leave. A month later Bilal won the award. He
said, "Every entrepreneur needs rhythm, a clean conscience, and sound judgment. The bureaucracy
is only a small hill to climb."`
  },
  {
    title: "The Committee's Extraordinary Challenge (Mixed)",
    text: `Every year the city committee organizes an extraordinary typing challenge for young
people. This year the rules were quite strict. The questionnaire said that accuracy was more
necessary than speed, and that every professional should feel the rhythm of the keyboard. Hina
was nervous. She had experience, but long words like responsibilities and characteristics
always made her slow down. Her coach told her, "Do not separate your mind from your fingers.
Breathe through each word, even though it looks difficult." On the day of the challenge the
hall was quiet. Hina typed environment, communication, and bureaucracy without a single error.
Then came the hardest line: accommodation, embarrassing, occurrence, and handkerchief. She
slowed down a little, kept her rhythm, and typed them successfully. When the results came, she
was surprised to receive the first prize. The committee said her judgment and calm nature were
even better than her speed. Unfortunately, her friend Sana became desperate and lost her focus,
but Hina promised to help her practice tomorrow. Their teacher smiled and said, "Your effort
will affect your future more than you think."`
  },
  {
    title: "The Entrepreneur's Handkerchief (Mixed)",
    text: `Kamran was a young entrepreneur who started a small software development company in a
busy market. In the beginning his office had no air conditioning, and his only friend was an
old handkerchief that he used to wipe his forehead. Unfortunately, his first clients did not
trust him. They said he had no experience. Kamran did not lose hope. He knew that understanding
people was the key to good communication. He visited every shop, listened to every complaint,
and wrote everything down. Slowly his business started to grow. One day a big company sent him
a long questionnaire full of difficult questions. It felt like the bureaucracy of a government
office. Kamran read it twice, used his judgment, and replied with clear and honest answers. His
conscience was clean, so he was not afraid. The company liked his professional attitude and
offered him a large contract. Now his computers update automatically, his team works in a
pleasant environment, and his name is known across the city. Kamran still keeps that old
handkerchief in his drawer. When someone asks him why, he says, "It reminds me that every
extraordinary journey begins with one small and quiet step."`
  }
];
