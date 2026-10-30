export interface Facts {
  home: string;
  office: string;
  karate: string;
}

const FACTS: Facts = {
  home: "Edinburgh",
  office: "Glasgow",
  karate: "Stirling",
};

export function getFacts(): Facts {
  return FACTS;
}
