"""
String utility functions for text processing and formatting
"""


def format_number(num: float, locale: str = "en-US") -> str:
    """
    Format a number with thousands separators

    Args:
        num: Number to format
        locale: Locale for formatting (default: 'en-US')

    Returns:
        Formatted number string
    """
    return f"{num:,.2f}"


def is_even(num: int) -> bool:
    """
    Check if a number is even

    Args:
        num: Number to check

    Returns:
        True if number is even, false otherwise
    """
    return num % 2 == 0


def is_odd(num: int) -> bool:
    """
    Check if a number is odd

    Args:
        num: Number to check

    Returns:
        True if number is odd, false otherwise
    """
    return num % 2 != 0


def clamp(value: float, min_val: float, max_val: float) -> float:
    """
    Clamp a value between min and max bounds

    Args:
        value: Value to clamp
        min_val: Minimum allowed value
        max_val: Maximum allowed value

    Returns:
        Clamped value
    """
    return min(max(value, min_val), max_val)


def capitalize(s: str) -> str:
    """
    Capitalize the first letter of a string

    Args:
        s: String to capitalize

    Returns:
        String with first letter capitalized
    """
    if not s:
        return s
    return s[0].upper() + s[1:].lower()


def to_title_case(s: str) -> str:
    """
    Convert string to title case

    Args:
        s: String to convert

    Returns:
        String in title case
    """
    return " ".join(capitalize(word) for word in s.split(" "))


def truncate(s: str, max_length: int) -> str:
    """
    Truncate string to specified length with ellipsis

    Args:
        s: String to truncate
        max_length: Maximum length

    Returns:
        Truncated string
    """
    if len(s) <= max_length:
        return s
    return s[: max_length - 3] + "..."

