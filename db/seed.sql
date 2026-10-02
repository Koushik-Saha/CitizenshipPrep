-- Local development seed. `pnpm db:reset` runs it after the migrations.
--
-- Everything here is SAMPLE content. The questions are seeded as `in_review`
-- with no verification stamps, because nobody has checked them against their
-- sources yet. They become visible to learners only when a reviewer publishes
-- them, which records who verified them and when.

insert into public.countries (iso_code, name, has_exam, exam_languages) values
  ('US', 'United States', true, '{en}'),
  ('CA', 'Canada', true, '{en,fr}'),
  ('GB', 'United Kingdom', true, '{en}'),
  ('AU', 'Australia', true, '{en}'),
  ('DE', 'Germany', true, '{de}');

insert into public.exam_formats
  (country_code, slug, name, format_type, question_count, pass_mark, time_limit_minutes,
   question_pool_size, is_current, source_url, notes)
values
  ('US', 'civics-2025', 'Naturalization civics test (2025)', 'oral', 20, 12, null, 128, true,
   'https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test',
   'For Form N-400 filed on or after October 20, 2025. An officer asks the questions aloud and stops once 12 are answered correctly or 9 incorrectly.'),
  ('US', 'civics-2008', 'Naturalization civics test (2008)', 'oral', 10, 6, null, 100, false,
   'https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test',
   'For Form N-400 filed before October 20, 2025. An officer asks the questions aloud and stops once 6 are answered correctly or 5 incorrectly.'),
  ('US', 'english', 'Naturalization English test', 'language', null, null, null, null, true,
   'https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test',
   'Speaking, reading and writing, assessed during the naturalization interview.'),
  ('CA', 'citizenship-test', 'Citizenship test', 'written', 20, 15, 45, null, true,
   'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/citizenship-test.html',
   'Multiple-choice and true-or-false questions, in English or French, based on the study guide Discover Canada.'),
  ('GB', 'life-in-the-uk', 'Life in the UK Test', 'written', 24, 18, 45, null, true,
   'https://www.gov.uk/life-in-the-uk-test',
   'Taken on a computer at a test centre. The pass mark is 75%.'),
  ('AU', 'citizenship-test', 'Australian citizenship test', 'written', 20, 15, 45, null, true,
   'https://immi.homeaffairs.gov.au/citizenship/test-and-interview/learn-about-citizenship-interview-and-test/learn-about-citizenship-test',
   'Multiple choice, in English. All 5 questions on Australian values must be answered correctly, as well as reaching 75% overall.'),
  ('DE', 'einbuergerungstest', 'Einbürgerungstest', 'written', 33, 17, 60, 310, true,
   'https://www.bamf.de/DE/Themen/Integration/ZugewanderteTeilnehmende/Einbuergerung/einbuergerung-node.html',
   '30 general questions and 3 about the federal state where the applicant lives. The pool is 300 general questions plus 10 per state.');

insert into public.topics (country_code, slug, name, sort_order) values
  ('US', 'american-government', 'American Government', 1),
  ('US', 'american-history', 'American History', 2),
  ('US', 'symbols-and-holidays', 'Symbols and Holidays', 3),
  ('CA', 'government', 'Government and Democracy', 1),
  ('CA', 'history', 'History', 2),
  ('CA', 'geography-and-symbols', 'Geography and Symbols', 3),
  ('GB', 'government-and-law', 'Government and the Law', 1),
  ('GB', 'history', 'History', 2),
  ('GB', 'nations-and-traditions', 'Nations and Traditions', 3),
  ('AU', 'australia-and-its-people', 'Australia and Its People', 1),
  ('AU', 'government-and-the-law', 'Government and the Law', 2),
  ('AU', 'australian-values', 'Australian Values', 3),
  ('DE', 'politik-in-der-demokratie', 'Politik in der Demokratie', 1),
  ('DE', 'geschichte-und-verantwortung', 'Geschichte und Verantwortung', 2),
  ('DE', 'mensch-und-gesellschaft', 'Mensch und Gesellschaft', 3);

-- Questions are written as JSON so each one keeps its translations beside it.
-- "answer" is the key of the correct option; "t" maps locale -> wording.
do $seed$
declare
  item jsonb;
  locale_key text;
  wording jsonb;
  new_question_id uuid;
  sources constant jsonb := $json${
    "US": "https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test",
    "CA": "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada.html",
    "GB": "https://www.gov.uk/life-in-the-uk-test",
    "AU": "https://immi.homeaffairs.gov.au/citizenship/test-and-interview/our-common-bond",
    "DE": "https://www.bamf.de/DE/Themen/Integration/ZugewanderteTeilnehmende/Einbuergerung/einbuergerung-node.html"
  }$json$;
  exam_slugs constant jsonb := $json${
    "US": "civics-2025",
    "CA": "citizenship-test",
    "GB": "life-in-the-uk",
    "AU": "citizenship-test",
    "DE": "einbuergerungstest"
  }$json$;
begin
  for item in
    select value from jsonb_array_elements($json$[
      {"c": "US", "topic": "american-government", "d": 1, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "What is the supreme law of the land?",
        "options": {"a": "The Declaration of Independence", "b": "The Constitution", "c": "The Bill of Rights", "d": "The Emancipation Proclamation"},
        "explanation": "The U.S. Constitution sets up the government and protects basic rights. Every other law must agree with it."}}},
      {"c": "US", "topic": "american-government", "d": 2, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "How many amendments does the U.S. Constitution have?",
        "options": {"a": "10", "b": "21", "c": "27", "d": "50"},
        "explanation": "There are 27 amendments. The first 10 are known as the Bill of Rights."}}},
      {"c": "US", "topic": "american-government", "d": 1, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "What are the two parts of the U.S. Congress?",
        "options": {"a": "The Senate and the House of Representatives", "b": "The Senate and the Supreme Court", "c": "The House of Representatives and the Cabinet", "d": "The President and the Senate"},
        "explanation": "Congress is the legislative branch. It is made up of the Senate and the House of Representatives."}}},
      {"c": "US", "topic": "american-government", "d": 1, "type": "multiple_choice", "answer": "d", "t": {"en": {
        "text": "How many U.S. senators are there?",
        "options": {"a": "50", "b": "435", "c": "9", "d": "100"},
        "explanation": "Each of the 50 states elects two senators, which makes 100."}}},
      {"c": "US", "topic": "american-government", "d": 2, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "For how many years is a U.S. senator elected?",
        "options": {"a": "Two years", "b": "Four years", "c": "Six years", "d": "Eight years"},
        "explanation": "A senator serves a six-year term. Members of the House of Representatives serve two years."}}},
      {"c": "US", "topic": "american-government", "d": 1, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "What is the highest court in the United States?",
        "options": {"a": "The Court of Appeals", "b": "The Supreme Court", "c": "The District Court", "d": "The Senate"},
        "explanation": "The Supreme Court heads the judicial branch and has the final say on what the Constitution means."}}},
      {"c": "US", "topic": "american-history", "d": 1, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "Who was the first President of the United States?",
        "options": {"a": "George Washington", "b": "Thomas Jefferson", "c": "Abraham Lincoln", "d": "John Adams"},
        "explanation": "George Washington became the first President in 1789."}}},
      {"c": "US", "topic": "american-history", "d": 2, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "When was the Declaration of Independence adopted?",
        "options": {"a": "July 4, 1787", "b": "September 17, 1787", "c": "July 4, 1776", "d": "December 15, 1791"},
        "explanation": "The Declaration of Independence was adopted on July 4, 1776."}}},
      {"c": "US", "topic": "american-history", "d": 1, "type": "multiple_choice", "answer": "d", "t": {"en": {
        "text": "Which war was fought between the North and the South of the United States?",
        "options": {"a": "The Revolutionary War", "b": "The War of 1812", "c": "World War I", "d": "The Civil War"},
        "explanation": "The Civil War (1861 to 1865) was fought between the northern and the southern states."}}},
      {"c": "US", "topic": "symbols-and-holidays", "d": 1, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "When is Independence Day celebrated?",
        "options": {"a": "January 1", "b": "July 4", "c": "The last Monday in May", "d": "November 11"},
        "explanation": "Independence Day is July 4, the date the Declaration of Independence was adopted."}}},

      {"c": "CA", "topic": "government", "d": 1, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "What are the two official languages of Canada?",
        "options": {"a": "English and Spanish", "b": "French and Inuktitut", "c": "English and French", "d": "English and Cree"},
        "explanation": "English and French have equal status in Parliament and across the federal government."}}},
      {"c": "CA", "topic": "government", "d": 2, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "Who is Canada's Head of State?",
        "options": {"a": "The Sovereign (the King or Queen)", "b": "The Prime Minister", "c": "The Governor General", "d": "The Speaker of the House of Commons"},
        "explanation": "Canada is a constitutional monarchy. The Sovereign is Head of State and is represented in Canada by the Governor General; the Prime Minister is Head of Government."}}},
      {"c": "CA", "topic": "government", "d": 2, "type": "multiple_choice", "answer": "d", "t": {"en": {
        "text": "What are the three parts of Parliament?",
        "options": {"a": "The Prime Minister, the Cabinet and the Senate", "b": "The House of Commons, the courts and the provinces", "c": "The Governor General, the premiers and the mayors", "d": "The Sovereign, the Senate and the House of Commons"},
        "explanation": "Parliament is made up of the Sovereign, the Senate and the House of Commons."}}},
      {"c": "CA", "topic": "government", "d": 2, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "What are the three levels of government in Canada?",
        "options": {"a": "National, regional and district", "b": "Federal, provincial or territorial, and municipal", "c": "Federal, state and county", "d": "Royal, parliamentary and judicial"},
        "explanation": "Canada has federal, provincial or territorial, and municipal (local) governments, each with its own responsibilities."}}},
      {"c": "CA", "topic": "government", "d": 3, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "In what year did the Canadian Charter of Rights and Freedoms become part of the Constitution?",
        "options": {"a": "1867", "b": "1931", "c": "1982", "d": "1999"},
        "explanation": "The Constitution was amended in 1982 to include the Canadian Charter of Rights and Freedoms."}}},
      {"c": "CA", "topic": "history", "d": 2, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "In what year did Confederation create the Dominion of Canada?",
        "options": {"a": "1867", "b": "1812", "c": "1776", "d": "1949"},
        "explanation": "The Dominion of Canada was formed on July 1, 1867."}}},
      {"c": "CA", "topic": "history", "d": 2, "type": "multiple_choice", "answer": "d", "t": {"en": {
        "text": "Who was Canada's first Prime Minister?",
        "options": {"a": "Sir Wilfrid Laurier", "b": "Sir George-Étienne Cartier", "c": "William Lyon Mackenzie King", "d": "Sir John A. Macdonald"},
        "explanation": "Sir John A. Macdonald, a Father of Confederation, became the first Prime Minister in 1867."}}},
      {"c": "CA", "topic": "geography-and-symbols", "d": 1, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "What is the capital city of Canada?",
        "options": {"a": "Toronto", "b": "Ottawa", "c": "Montréal", "d": "Vancouver"},
        "explanation": "Ottawa, in Ontario, is the national capital."}}},
      {"c": "CA", "topic": "geography-and-symbols", "d": 1, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "How many provinces and territories does Canada have?",
        "options": {"a": "Ten provinces and two territories", "b": "Twelve provinces and one territory", "c": "Ten provinces and three territories", "d": "Thirteen provinces"},
        "explanation": "Canada has ten provinces and three territories: Yukon, the Northwest Territories and Nunavut."}}},
      {"c": "CA", "topic": "geography-and-symbols", "d": 1, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "When is Canada Day?",
        "options": {"a": "July 1", "b": "July 4", "c": "November 11", "d": "The first Monday in September"},
        "explanation": "Canada Day, July 1, marks the anniversary of Confederation in 1867."}}},

      {"c": "GB", "topic": "nations-and-traditions", "d": 1, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "Which countries make up the United Kingdom?",
        "options": {"a": "England, Scotland and Wales", "b": "England, Scotland, Wales and Northern Ireland", "c": "England, Scotland, Wales and Ireland", "d": "England, Wales and Northern Ireland"},
        "explanation": "The UK is England, Scotland, Wales and Northern Ireland. Great Britain refers only to England, Scotland and Wales."}}},
      {"c": "GB", "topic": "nations-and-traditions", "d": 1, "type": "multiple_choice", "answer": "d", "t": {"en": {
        "text": "What is the capital city of Scotland?",
        "options": {"a": "Glasgow", "b": "Cardiff", "c": "Aberdeen", "d": "Edinburgh"},
        "explanation": "Edinburgh is the capital of Scotland. Cardiff is the capital of Wales and Belfast the capital of Northern Ireland."}}},
      {"c": "GB", "topic": "nations-and-traditions", "d": 2, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "Who is the patron saint of Wales?",
        "options": {"a": "St David", "b": "St Andrew", "c": "St George", "d": "St Patrick"},
        "explanation": "St David is the patron saint of Wales. St David's Day is 1 March."}}},
      {"c": "GB", "topic": "nations-and-traditions", "d": 2, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "Who is the patron saint of Scotland?",
        "options": {"a": "St David", "b": "St George", "c": "St Andrew", "d": "St Patrick"},
        "explanation": "St Andrew is the patron saint of Scotland. St Andrew's Day is 30 November."}}},
      {"c": "GB", "topic": "nations-and-traditions", "d": 1, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "Which flower is the national flower of England?",
        "options": {"a": "The daffodil", "b": "The rose", "c": "The thistle", "d": "The shamrock"},
        "explanation": "The rose is associated with England, the daffodil with Wales, the thistle with Scotland and the shamrock with Northern Ireland."}}},
      {"c": "GB", "topic": "history", "d": 2, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "In which year did the Battle of Hastings take place?",
        "options": {"a": "1066", "b": "1215", "c": "1415", "d": "1588"},
        "explanation": "In 1066 William, Duke of Normandy, defeated King Harold at the Battle of Hastings."}}},
      {"c": "GB", "topic": "history", "d": 3, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "In which year was Magna Carta agreed?",
        "options": {"a": "1066", "b": "1348", "c": "1215", "d": "1689"},
        "explanation": "King John agreed to Magna Carta in 1215. It established that even the king was subject to the law."}}},
      {"c": "GB", "topic": "government-and-law", "d": 1, "type": "multiple_choice", "answer": "d", "t": {"en": {
        "text": "Who is the head of state of the United Kingdom?",
        "options": {"a": "The Prime Minister", "b": "The Speaker of the House of Commons", "c": "The Archbishop of Canterbury", "d": "The monarch"},
        "explanation": "The UK is a constitutional monarchy. The monarch is head of state, and the Prime Minister leads the government."}}},
      {"c": "GB", "topic": "government-and-law", "d": 1, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "What are members of the House of Commons called?",
        "options": {"a": "Peers", "b": "Members of Parliament (MPs)", "c": "Councillors", "d": "Senators"},
        "explanation": "Each MP is elected to represent a constituency in the House of Commons."}}},
      {"c": "GB", "topic": "government-and-law", "d": 1, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "What is the official home of the Prime Minister?",
        "options": {"a": "10 Downing Street", "b": "Buckingham Palace", "c": "The Palace of Westminster", "d": "Windsor Castle"},
        "explanation": "The Prime Minister's official home is 10 Downing Street, in central London."}}},

      {"c": "AU", "topic": "australia-and-its-people", "d": 1, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "What is the capital city of Australia?",
        "options": {"a": "Sydney", "b": "Melbourne", "c": "Canberra", "d": "Brisbane"},
        "explanation": "Canberra, in the Australian Capital Territory, is the national capital."}}},
      {"c": "AU", "topic": "australia-and-its-people", "d": 2, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "What do Australians remember on Anzac Day?",
        "options": {"a": "The landing of the Australian and New Zealand Army Corps at Gallipoli in World War I", "b": "The arrival of the First Fleet at Sydney Cove", "c": "The opening of the first Commonwealth Parliament", "d": "The end of World War II"},
        "explanation": "Anzac Day, 25 April, is named after the Australian and New Zealand Army Corps, which landed at Gallipoli in 1915. It honours all Australians who have served in wars and conflicts."}}},
      {"c": "AU", "topic": "australia-and-its-people", "d": 2, "type": "multiple_choice", "answer": "d", "t": {"en": {
        "text": "What are the colours of the Australian Aboriginal flag?",
        "options": {"a": "Green, white and blue", "b": "Green and gold", "c": "Red, white and blue", "d": "Black, red and yellow"},
        "explanation": "The Australian Aboriginal flag is black, red and yellow."}}},
      {"c": "AU", "topic": "australia-and-its-people", "d": 1, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "On which date is Australia Day?",
        "options": {"a": "25 April", "b": "26 January", "c": "1 January", "d": "11 November"},
        "explanation": "Australia Day is 26 January, the anniversary of the arrival of the First Fleet in 1788."}}},
      {"c": "AU", "topic": "australia-and-its-people", "d": 2, "type": "multiple_choice", "answer": "c", "t": {"en": {
        "text": "What is Australia's national flower?",
        "options": {"a": "The waratah", "b": "The kangaroo paw", "c": "The golden wattle", "d": "The banksia"},
        "explanation": "The golden wattle is the national flower. Green and gold, its colours, are Australia's national colours."}}},
      {"c": "AU", "topic": "government-and-the-law", "d": 1, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "How many states does Australia have?",
        "options": {"a": "Six", "b": "Five", "c": "Seven", "d": "Eight"},
        "explanation": "Australia has six states and two mainland territories."}}},
      {"c": "AU", "topic": "government-and-the-law", "d": 2, "type": "multiple_choice", "answer": "b", "t": {"en": {
        "text": "Who is Australia's Head of State?",
        "options": {"a": "The Prime Minister", "b": "The King of Australia", "c": "The Governor-General", "d": "The Chief Justice of the High Court"},
        "explanation": "Australia's Head of State is the King of Australia, who is represented in Australia by the Governor-General."}}},
      {"c": "AU", "topic": "government-and-the-law", "d": 2, "type": "multiple_choice", "answer": "d", "t": {"en": {
        "text": "What are the three levels of government in Australia?",
        "options": {"a": "National, regional and tribal", "b": "Federal, provincial and municipal", "c": "Royal, federal and state", "d": "Federal, state or territory, and local"},
        "explanation": "Australia has a federal government, state and territory governments, and local governments."}}},
      {"c": "AU", "topic": "government-and-the-law", "d": 1, "type": "true_false", "answer": "true", "t": {"en": {
        "text": "Voting in federal elections is compulsory for Australian citizens aged 18 or over.",
        "options": {"true": "True", "false": "False"},
        "explanation": "Australian citizens aged 18 or over must enrol and vote in federal elections."}}},
      {"c": "AU", "topic": "australian-values", "d": 1, "type": "multiple_choice", "answer": "a", "t": {"en": {
        "text": "Which statement about equality in Australia is correct?",
        "options": {"a": "Men and women have equal rights", "b": "Men have more legal rights than women", "c": "Rights depend on a person's religion", "d": "Rights depend on where a person was born"},
        "explanation": "Equality of men and women, and equal opportunity for everyone, are Australian values."}}},

      {"c": "DE", "topic": "politik-in-der-demokratie", "d": 1, "type": "multiple_choice", "answer": "b", "t": {
        "de": {"text": "Wie heißt die Verfassung der Bundesrepublik Deutschland?",
          "options": {"a": "Bundesverfassung", "b": "Grundgesetz", "c": "Staatsvertrag", "d": "Reichsverfassung"},
          "explanation": "Das Grundgesetz ist die Verfassung der Bundesrepublik Deutschland."},
        "en": {"text": "What is the constitution of the Federal Republic of Germany called?",
          "options": {"a": "Bundesverfassung (Federal Constitution)", "b": "Grundgesetz (Basic Law)", "c": "Staatsvertrag (State Treaty)", "d": "Reichsverfassung (Imperial Constitution)"},
          "explanation": "Germany's constitution is the Grundgesetz, the Basic Law."}}},
      {"c": "DE", "topic": "politik-in-der-demokratie", "d": 1, "type": "multiple_choice", "answer": "c", "t": {
        "de": {"text": "Wie viele Bundesländer hat die Bundesrepublik Deutschland?",
          "options": {"a": "14", "b": "15", "c": "16", "d": "17"},
          "explanation": "Deutschland besteht aus 16 Bundesländern."},
        "en": {"text": "How many federal states does the Federal Republic of Germany have?",
          "options": {"a": "14", "b": "15", "c": "16", "d": "17"},
          "explanation": "Germany is made up of 16 federal states (Bundesländer)."}}},
      {"c": "DE", "topic": "politik-in-der-demokratie", "d": 2, "type": "multiple_choice", "answer": "a", "t": {
        "de": {"text": "Wer wählt die Bundeskanzlerin oder den Bundeskanzler?",
          "options": {"a": "Der Bundestag", "b": "Der Bundesrat", "c": "Das Volk in direkter Wahl", "d": "Die Bundesversammlung"},
          "explanation": "Die Bundeskanzlerin oder der Bundeskanzler wird vom Bundestag gewählt."},
        "en": {"text": "Who elects the Federal Chancellor?",
          "options": {"a": "The Bundestag", "b": "The Bundesrat", "c": "The people, in a direct vote", "d": "The Federal Convention"},
          "explanation": "The Federal Chancellor is elected by the Bundestag, the federal parliament."}}},
      {"c": "DE", "topic": "politik-in-der-demokratie", "d": 2, "type": "multiple_choice", "answer": "d", "t": {
        "de": {"text": "Wer ist das Staatsoberhaupt der Bundesrepublik Deutschland?",
          "options": {"a": "Die Bundeskanzlerin oder der Bundeskanzler", "b": "Die Präsidentin oder der Präsident des Bundestages", "c": "Die Präsidentin oder der Präsident des Bundesrates", "d": "Die Bundespräsidentin oder der Bundespräsident"},
          "explanation": "Staatsoberhaupt ist die Bundespräsidentin oder der Bundespräsident."},
        "en": {"text": "Who is the head of state of the Federal Republic of Germany?",
          "options": {"a": "The Federal Chancellor", "b": "The President of the Bundestag", "c": "The President of the Bundesrat", "d": "The Federal President"},
          "explanation": "The Federal President is the head of state. The Federal Chancellor leads the government."}}},
      {"c": "DE", "topic": "politik-in-der-demokratie", "d": 1, "type": "multiple_choice", "answer": "b", "t": {
        "de": {"text": "Ab welchem Alter darf man in Deutschland bei der Bundestagswahl wählen?",
          "options": {"a": "16", "b": "18", "c": "20", "d": "21"},
          "explanation": "Bei der Bundestagswahl dürfen deutsche Staatsangehörige ab 18 Jahren wählen."},
        "en": {"text": "From what age may people vote in elections to the Bundestag?",
          "options": {"a": "16", "b": "18", "c": "20", "d": "21"},
          "explanation": "German citizens may vote in Bundestag elections from the age of 18."}}},
      {"c": "DE", "topic": "geschichte-und-verantwortung", "d": 2, "type": "multiple_choice", "answer": "c", "t": {
        "de": {"text": "In welchem Jahr wurde die Bundesrepublik Deutschland gegründet?",
          "options": {"a": "1945", "b": "1947", "c": "1949", "d": "1961"},
          "explanation": "Die Bundesrepublik Deutschland wurde 1949 gegründet, als das Grundgesetz in Kraft trat."},
        "en": {"text": "In which year was the Federal Republic of Germany founded?",
          "options": {"a": "1945", "b": "1947", "c": "1949", "d": "1961"},
          "explanation": "The Federal Republic of Germany was founded in 1949, when the Basic Law came into force."}}},
      {"c": "DE", "topic": "geschichte-und-verantwortung", "d": 2, "type": "multiple_choice", "answer": "a", "t": {
        "de": {"text": "In welchem Jahr fiel die Berliner Mauer?",
          "options": {"a": "1989", "b": "1961", "c": "1990", "d": "1975"},
          "explanation": "Die Berliner Mauer fiel am 9. November 1989."},
        "en": {"text": "In which year did the Berlin Wall fall?",
          "options": {"a": "1989", "b": "1961", "c": "1990", "d": "1975"},
          "explanation": "The Berlin Wall fell on 9 November 1989."}}},
      {"c": "DE", "topic": "geschichte-und-verantwortung", "d": 2, "type": "multiple_choice", "answer": "d", "t": {
        "de": {"text": "An welchem Datum wird der Tag der Deutschen Einheit gefeiert?",
          "options": {"a": "1. Mai", "b": "9. November", "c": "23. Mai", "d": "3. Oktober"},
          "explanation": "Der 3. Oktober erinnert an die deutsche Wiedervereinigung im Jahr 1990."},
        "en": {"text": "On which date is the Day of German Unity celebrated?",
          "options": {"a": "1 May", "b": "9 November", "c": "23 May", "d": "3 October"},
          "explanation": "3 October marks German reunification in 1990."}}},
      {"c": "DE", "topic": "mensch-und-gesellschaft", "d": 1, "type": "multiple_choice", "answer": "b", "t": {
        "de": {"text": "Was ist die Hauptstadt der Bundesrepublik Deutschland?",
          "options": {"a": "Bonn", "b": "Berlin", "c": "München", "d": "Frankfurt am Main"},
          "explanation": "Berlin ist die Hauptstadt Deutschlands."},
        "en": {"text": "What is the capital of the Federal Republic of Germany?",
          "options": {"a": "Bonn", "b": "Berlin", "c": "Munich", "d": "Frankfurt am Main"},
          "explanation": "Berlin is the capital of Germany."}}},
      {"c": "DE", "topic": "mensch-und-gesellschaft", "d": 1, "type": "multiple_choice", "answer": "a", "t": {
        "de": {"text": "Welche Farben hat die deutsche Flagge?",
          "options": {"a": "Schwarz, Rot, Gold", "b": "Schwarz, Weiß, Rot", "c": "Rot, Weiß, Blau", "d": "Schwarz, Gelb, Grün"},
          "explanation": "Die Bundesflagge ist schwarz-rot-gold."},
        "en": {"text": "What are the colours of the German flag?",
          "options": {"a": "Black, red, gold", "b": "Black, white, red", "c": "Red, white, blue", "d": "Black, yellow, green"},
          "explanation": "The federal flag is black, red and gold."}}}
    ]$json$::jsonb)
  loop
    insert into public.questions
      (country_code, topic_id, exam_format_id, difficulty, type, correct_answer, source_url, status)
    select
      item ->> 'c',
      topics.id,
      exam_formats.id,
      (item ->> 'd')::smallint,
      (item ->> 'type')::public.question_type,
      jsonb_build_object('keys', jsonb_build_array(item ->> 'answer')),
      sources ->> (item ->> 'c'),
      'in_review'
    from public.topics
    join public.exam_formats
      on exam_formats.country_code = topics.country_code
      and exam_formats.slug = exam_slugs ->> (item ->> 'c')
    where topics.country_code = item ->> 'c'
      and topics.slug = item ->> 'topic'
    returning id into strict new_question_id;

    for locale_key, wording in select key, value from jsonb_each(item -> 't')
    loop
      insert into public.question_translations (question_id, locale, text, options, explanation)
      values (
        new_question_id,
        locale_key,
        wording ->> 'text',
        (
          select jsonb_agg(jsonb_build_object('key', key, 'text', value) order by key)
          from jsonb_each_text(wording -> 'options')
        ),
        wording ->> 'explanation'
      );
    end loop;
  end loop;
end;
$seed$;
