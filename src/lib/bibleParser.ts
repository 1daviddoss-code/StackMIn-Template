import { XMLParser } from 'fast-xml-parser';

export interface Verse {
  book: string;
  chapter: number;
  verse: string; // Changed to string to support "1-3"
  text: string;
}

export interface BookInfo {
  bname: string;
  bnumber: number;
  testament: 'OT' | 'NT';
}

export interface BibleTranslation {
  name: string;
  books: BookInfo[];
  getVerses: (book: string, chapter: number, startVerse: string, endVerse: string) => Verse[];
  getChapters: (book: string) => number[];
  getVersesList: (book: string, chapter: number) => string[];
}

export function parseXMLBible(xmlString: string, name: string): BibleTranslation {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name) => ['BIBLEBOOK', 'CHAPTER', 'VERS'].includes(name)
  });

  const parsed = parser.parse(xmlString);
  const bibleBooks = parsed?.XMLBIBLE?.BIBLEBOOK || [];
  
  const books: BookInfo[] = [];
  const bookMap = new Map<string, any>();

  for (const b of bibleBooks) {
    const bname = b['@_bname'];
    const bnumber = parseInt(b['@_bnumber'], 10);
    if (bname) {
      books.push({
        bname,
        bnumber,
        testament: bnumber <= 39 ? 'OT' : 'NT'
      });
      bookMap.set(bname, b);
    }
  }

  return {
    name,
    books,
    getChapters: (bookName: string) => {
      const book = bookMap.get(bookName);
      if (!book) return [];
      const chapters = book.CHAPTER || [];
      return chapters.map((c: any) => parseInt(c['@_cnumber'], 10)).filter((n: number) => !isNaN(n));
    },
    getVersesList: (bookName: string, chapterNum: number) => {
      const book = bookMap.get(bookName);
      if (!book) return [];
      const chapters = book.CHAPTER || [];
      const chapter = chapters.find((c: any) => parseInt(c['@_cnumber'], 10) === chapterNum);
      if (!chapter) return [];
      const verses = chapter.VERS || [];
      return verses.map((v: any) => v['@_vnumber'].toString());
    },
    getVerses: (bookName: string, chapterNum: number, startVerse: string, endVerse: string) => {
      const book = bookMap.get(bookName);
      if (!book) return [];
      
      const chapters = book.CHAPTER || [];
      const chapter = chapters.find((c: any) => parseInt(c['@_cnumber'], 10) === chapterNum);
      if (!chapter) return [];

      const verses = chapter.VERS || [];
      const result: Verse[] = [];

      const startIndex = verses.findIndex((v: any) => v['@_vnumber'].toString() === startVerse);
      const endIndex = verses.findIndex((v: any) => v['@_vnumber'].toString() === endVerse);

      if (startIndex === -1) return [];
      
      const actualEndIndex = endIndex !== -1 && endIndex >= startIndex ? endIndex : startIndex;

      for (let i = startIndex; i <= actualEndIndex; i++) {
        const v = verses[i];
        let text = "";
        if (v['#text']) {
          text = v['#text'];
        } else if (typeof v === 'string') {
          text = v;
        } else {
          // Fallback if no #text but there's a string value somewhere
          text = Object.values(v).find(val => typeof val === 'string' && !val.toString().startsWith('@_')) as string || "";
        }

        result.push({
          book: bookName,
          chapter: chapterNum,
          verse: v['@_vnumber'].toString(),
          text: text.trim()
        });
      }

      return result;
    }
  };
}
