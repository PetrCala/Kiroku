type SearchUsersParams = {
  /** Raw, untokenized friend-search query; the server tokenizes and prefix-matches it. */
  q: string;
};

export default SearchUsersParams;
