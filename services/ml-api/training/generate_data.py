"""
generate_data.py — Build a small SYNTHETIC support-ticket dataset.

Why synthetic: the MVP must be reproducible offline and must not redistribute
third-party data (e.g. Bitext, CDLA-Sharing-1.0) before the licence is reviewed.
Tickets are composed from hand-written openers, category-specific complaints and
shared "noise" phrases (order/account/payment words appear in many categories),
so the task is not trivially separable — but it is still far easier than real
tickets. Metrics measured on this data MUST NOT be presented as real-world
performance. Swap in a real dataset by replacing data/tickets.csv.

Usage: python training/generate_data.py [--per-class 200] [--seed 42]
"""

import argparse
import csv
import random
from pathlib import Path

OPENERS = [
    "Hi team,", "Hello,", "Good morning,", "Urgent:", "Please help.", "Hey,",
    "To whom it may concern,", "I need some help.", "", "",
]

SHARED = [
    "I contacted support before but nobody replied.",
    "This has been going on for several days.",
    "My order number is in the confirmation email.",
    "I am using the website on my laptop.",
    "Please let me know what I should do next.",
    "I have already checked my account page.",
    "This is really frustrating.",
    "I paid with my credit card.",
]

CORE = {
    "account": [
        "I cannot log in to my account after resetting my password.",
        "How do I change the email address on my profile?",
        "My account was locked after too many sign in attempts.",
        "I want to update my username and phone number.",
        "I never received the verification email to activate my account.",
    ],
    "billing": [
        "I was charged twice on my last invoice.",
        "The amount on my monthly bill is higher than my plan price.",
        "Can you send me a copy of my invoice for tax purposes?",
        "There is an unknown charge on my credit card statement.",
        "How can I update the payment method used for my subscription?",
    ],
    "cancellation": [
        "I want to cancel my subscription before it renews.",
        "Please cancel my order, I ordered the wrong size.",
        "How do I terminate my membership permanently?",
        "I would like to cancel the purchase I made this morning.",
        "Stop my plan from renewing next month, I no longer need it.",
    ],
    "delivery": [
        "My package has not arrived and the delivery date has passed.",
        "The courier says delivered but I never received the parcel.",
        "Can I change the delivery address for my package?",
        "The delivery driver left my parcel at the wrong house.",
        "My delivery is late and the tracking page shows no updates.",
    ],
    "feedback": [
        "I just wanted to say your support agent was wonderful.",
        "I have a suggestion to improve the checkout page design.",
        "I would like to leave a complaint about the poor service I received.",
        "The new app layout is great, thank you for the update.",
        "Here is some feedback about your website, it is confusing to navigate.",
    ],
    "order": [
        "I want to check the status of my order.",
        "I need to change an item in the order I just placed.",
        "My order confirmation shows the wrong quantity of items.",
        "I placed an order but never got an order confirmation email.",
        "Can I add another product to my existing order?",
    ],
    "refund": [
        "I want a refund for the damaged item I received.",
        "Where is my refund? I returned the product two weeks ago.",
        "The product was not as described and I would like my money back.",
        "Please refund my purchase, the item stopped working.",
        "I was promised a refund but it has not appeared in my bank account.",
    ],
    "shipping": [
        "How much does international shipping cost to Canada?",
        "Do you offer express shipping options for my area?",
        "What shipping carriers do you use and how long does it take?",
        "I would like to know the shipping fee before I place my order.",
        "Can you ship to a PO box or to another country?",
    ],
    "technical": [
        "The app crashes every time I open the settings page.",
        "I get an error 500 when I try to upload a file.",
        "The website is very slow and the page keeps freezing.",
        "The mobile app will not load and shows a blank screen.",
        "There is a bug in the search function, it returns no results.",
    ],
    "other": [
        "Do you have a physical store I can visit?",
        "I am looking for a partnership or a job opportunity with your company.",
        "What are your opening hours on public holidays?",
        "I have a general question about your company.",
        "Can someone call me to talk about something not related to my order?",
    ],
}


def make_ticket(category: str, rng: random.Random) -> tuple[str, str]:
    core = rng.choice(CORE[category])
    parts = [rng.choice(OPENERS), core]
    # Shared noise appears regardless of category
    if rng.random() < 0.7:
        parts.append(rng.choice(SHARED))
    body = " ".join(p for p in parts if p)
    title = core.split(".")[0].split("?")[0][:80]
    return title, body


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=200)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="data/tickets.csv")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    rows = []
    for category in CORE:
        for _ in range(args.per_class):
            title, body = make_ticket(category, rng)
            rows.append((title, body, category))
    rng.shuffle(rows)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["title", "body", "category"])
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out}")


if __name__ == "__main__":
    main()
