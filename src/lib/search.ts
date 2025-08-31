
const isbn_regex = /^(?=[0-9]{13}$|(?=(?:[0-9]+[-\ ]){4})[-\ 0-9]{17}$)97[89][-\ ]?[0-9]{1,5}[-\ ]?[0-9]+[-\ ]?[0-9]+[-\ ]?[0-9]$/
const md5_regex = /^[a-fA-F0-9]{32}$/

export function detect_search_type(keyword:  string) : 'isbn' | 'md5' | 'normal' {
    if (isbn_regex.test(keyword.trim())) {
        return 'isbn'
    }
    if (md5_regex.test(keyword.trim())) {
        return 'md5'
    }
    return 'normal'
}