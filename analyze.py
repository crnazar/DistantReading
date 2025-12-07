#!/usr/bin/env python3
"""
Distant Reading Analysis System for Utopian Novels
Analyzes a corpus of texts using NLP techniques including word frequency,
sentiment analysis, style metrics, and topic modeling.
"""

import json
import os
import re
import string
from collections import Counter
from pathlib import Path

import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np

# Download required NLTK data
def download_nltk_data():
    """Download required NLTK resources."""
    resources = ['punkt', 'punkt_tab', 'stopwords', 'averaged_perceptron_tagger']
    for resource in resources:
        try:
            nltk.download(resource, quiet=True)
        except Exception:
            pass

download_nltk_data()

# Metadata for the novels
NOVEL_METADATA = {
    'Utopia.txt': {
        'title': 'Utopia',
        'author': 'Thomas More',
        'year': 1516
    },
    'NewAtlantis.txt': {
        'title': 'New Atlantis',
        'author': 'Francis Bacon',
        'year': 1627
    },
    'LookingBackward.txt': {
        'title': 'Looking Backward: 2000-1887',
        'author': 'Edward Bellamy',
        'year': 1888
    },
    'NewsfromNowhere.txt': {
        'title': 'News from Nowhere',
        'author': 'William Morris',
        'year': 1890
    },
    'ModernUtopia.txt': {
        'title': 'A Modern Utopia',
        'author': 'H.G. Wells',
        'year': 1905
    },
    'Herland.txt': {
        'title': 'Herland',
        'author': 'Charlotte Perkins Gilman',
        'year': 1915
    },
    'OvertheRange.txt': {
        'title': 'Over the Range',
        'author': 'Unknown',
        'year': 1900
    }
}


def clean_gutenberg_text(text):
    """Remove Project Gutenberg header and footer."""
    # Find start marker
    start_markers = [
        r'\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK',
        r'\*\*\*START OF (THE|THIS) PROJECT GUTENBERG EBOOK',
    ]

    # Find end marker
    end_markers = [
        r'\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK',
        r'\*\*\*END OF (THE|THIS) PROJECT GUTENBERG EBOOK',
        r'End of (the )?Project Gutenberg',
    ]

    # Remove BOM and normalize whitespace
    text = text.replace('\ufeff', '')

    # Find and remove header
    for pattern in start_markers:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            text = text[match.end():]
            break

    # Find and remove footer
    for pattern in end_markers:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            text = text[:match.start()]
            break

    # Clean up extra whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def tokenize_text(text):
    """Tokenize text into words."""
    tokens = word_tokenize(text.lower())
    # Keep only alphabetic tokens
    tokens = [t for t in tokens if t.isalpha()]
    return tokens


def get_sentences(text):
    """Split text into sentences."""
    return sent_tokenize(text)


def calculate_word_frequencies(tokens, top_n=50):
    """Calculate word frequencies, excluding stopwords."""
    stop_words = set(stopwords.words('english'))
    # Filter out stopwords and short words
    filtered_tokens = [t for t in tokens if t not in stop_words and len(t) > 2]
    freq = Counter(filtered_tokens)
    return freq.most_common(top_n)


def calculate_sentiment(text):
    """Analyze sentiment using VADER."""
    analyzer = SentimentIntensityAnalyzer()
    sentences = get_sentences(text)

    sentence_scores = []
    for sentence in sentences:
        scores = analyzer.polarity_scores(sentence)
        sentence_scores.append(scores)

    # Aggregate scores
    if not sentence_scores:
        return {
            'compound': 0,
            'positive': 0,
            'negative': 0,
            'neutral': 0,
            'sentence_count': 0,
            'distribution': {'positive': 0, 'negative': 0, 'neutral': 0}
        }

    avg_compound = np.mean([s['compound'] for s in sentence_scores])
    avg_positive = np.mean([s['pos'] for s in sentence_scores])
    avg_negative = np.mean([s['neg'] for s in sentence_scores])
    avg_neutral = np.mean([s['neu'] for s in sentence_scores])

    # Count sentiment distribution
    positive_count = sum(1 for s in sentence_scores if s['compound'] > 0.05)
    negative_count = sum(1 for s in sentence_scores if s['compound'] < -0.05)
    neutral_count = len(sentence_scores) - positive_count - negative_count

    return {
        'compound': round(avg_compound, 4),
        'positive': round(avg_positive, 4),
        'negative': round(avg_negative, 4),
        'neutral': round(avg_neutral, 4),
        'sentence_count': len(sentence_scores),
        'distribution': {
            'positive': positive_count,
            'negative': negative_count,
            'neutral': neutral_count
        }
    }


def calculate_style_metrics(text, tokens):
    """Calculate style metrics: TTR, vocabulary richness, sentence length."""
    sentences = get_sentences(text)

    # Type-Token Ratio
    unique_tokens = set(tokens)
    ttr = len(unique_tokens) / len(tokens) if tokens else 0

    # Vocabulary richness - Hapax legomena ratio
    freq = Counter(tokens)
    hapax = sum(1 for word, count in freq.items() if count == 1)
    hapax_ratio = hapax / len(unique_tokens) if unique_tokens else 0

    # Yule's K measure
    freq_of_freq = Counter(freq.values())
    m1 = len(tokens)
    m2 = sum(f * (count ** 2) for count, f in freq_of_freq.items())
    yules_k = 10000 * (m2 - m1) / (m1 ** 2) if m1 > 0 else 0

    # Sentence length statistics
    sentence_lengths = [len(word_tokenize(s)) for s in sentences]

    # Word length statistics
    word_lengths = [len(t) for t in tokens]

    return {
        'type_token_ratio': round(ttr, 4),
        'vocabulary_size': len(unique_tokens),
        'total_tokens': len(tokens),
        'hapax_legomena': hapax,
        'hapax_ratio': round(hapax_ratio, 4),
        'yules_k': round(yules_k, 4),
        'sentence_stats': {
            'count': len(sentences),
            'mean_length': round(np.mean(sentence_lengths), 2) if sentence_lengths else 0,
            'median_length': round(np.median(sentence_lengths), 2) if sentence_lengths else 0,
            'std_length': round(np.std(sentence_lengths), 2) if sentence_lengths else 0,
            'min_length': min(sentence_lengths) if sentence_lengths else 0,
            'max_length': max(sentence_lengths) if sentence_lengths else 0
        },
        'word_stats': {
            'mean_length': round(np.mean(word_lengths), 2) if word_lengths else 0,
            'median_length': round(np.median(word_lengths), 2) if word_lengths else 0
        }
    }


def perform_topic_modeling(corpus_texts, n_topics=4, n_top_words=10):
    """Perform LDA topic modeling on the corpus."""
    # Create document-term matrix
    stop_words = list(stopwords.words('english'))
    vectorizer = CountVectorizer(
        max_df=0.95,
        min_df=2,
        stop_words=stop_words,
        max_features=1000
    )

    doc_term_matrix = vectorizer.fit_transform(corpus_texts)
    feature_names = vectorizer.get_feature_names_out()

    # Fit LDA model
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method='batch'
    )

    doc_topic_matrix = lda.fit_transform(doc_term_matrix)

    # Extract topics
    topics = []
    for topic_idx, topic in enumerate(lda.components_):
        top_word_indices = topic.argsort()[:-n_top_words - 1:-1]
        top_words = [(feature_names[i], round(topic[i], 4)) for i in top_word_indices]
        topics.append({
            'id': topic_idx,
            'words': top_words
        })

    # Document-topic distributions
    doc_topics = []
    for doc_idx, doc_topic_dist in enumerate(doc_topic_matrix):
        doc_topics.append([round(score, 4) for score in doc_topic_dist])

    return {
        'n_topics': n_topics,
        'topics': topics,
        'document_topic_distributions': doc_topics
    }


def analyze_text(filepath):
    """Analyze a single text file."""
    filename = os.path.basename(filepath)

    # Read and clean text
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        raw_text = f.read()

    clean_text = clean_gutenberg_text(raw_text)
    tokens = tokenize_text(clean_text)

    # Get metadata
    metadata = NOVEL_METADATA.get(filename, {
        'title': filename.replace('.txt', ''),
        'author': 'Unknown',
        'year': 0
    })

    # Perform analyses
    word_freq = calculate_word_frequencies(tokens)
    sentiment = calculate_sentiment(clean_text)
    style_metrics = calculate_style_metrics(clean_text, tokens)

    return {
        'filename': filename,
        'metadata': metadata,
        'word_frequencies': [{'word': w, 'count': c} for w, c in word_freq],
        'sentiment': sentiment,
        'style_metrics': style_metrics,
        'clean_text': clean_text  # Keep for topic modeling
    }


def main():
    """Main analysis pipeline."""
    # Find all text files (excluding requirements.txt and other non-novel files)
    script_dir = Path(__file__).parent
    excluded_files = {'requirements.txt'}
    txt_files = sorted([f for f in script_dir.glob('*.txt') if f.name not in excluded_files])

    if not txt_files:
        print("No text files found!")
        return

    print(f"Found {len(txt_files)} text files to analyze...")

    # Analyze each text
    results = []
    corpus_texts = []

    for filepath in txt_files:
        print(f"  Analyzing: {filepath.name}")
        analysis = analyze_text(filepath)
        corpus_texts.append(analysis['clean_text'])
        # Remove clean_text from output (too large)
        del analysis['clean_text']
        results.append(analysis)

    # Perform topic modeling on the corpus
    print("Performing topic modeling...")
    topic_results = perform_topic_modeling(corpus_texts, n_topics=4)

    # Add document-specific topic distributions
    for i, result in enumerate(results):
        result['topic_distribution'] = topic_results['document_topic_distributions'][i]

    # Prepare final output
    output = {
        'corpus_info': {
            'name': 'Utopian Novels Corpus',
            'description': 'A collection of utopian novels from Project Gutenberg (1516-1915)',
            'text_count': len(results),
            'total_tokens': sum(r['style_metrics']['total_tokens'] for r in results)
        },
        'topic_modeling': {
            'n_topics': topic_results['n_topics'],
            'topics': topic_results['topics']
        },
        'texts': results
    }

    # Write JSON output
    output_path = script_dir / 'analysis_results.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nAnalysis complete! Results saved to: {output_path}")
    print(f"  - Analyzed {len(results)} texts")
    print(f"  - Total tokens: {output['corpus_info']['total_tokens']:,}")
    print(f"  - Identified {topic_results['n_topics']} topics")


if __name__ == '__main__':
    main()
