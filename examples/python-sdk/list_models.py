#!/usr/bin/env python3
"""
Example: List available AI models

This example demonstrates how to use the Auggie.get_available_models() method
to retrieve and display the list of available AI models for your account.
"""

from auggie_sdk import Auggie

def main():
    """List all available models."""
    print("Fetching available models...")
    print()
    
    try:
        models = Auggie.get_available_models()
        
        print(f"Found {len(models)} available models:")
        print("=" * 80)
        print()
        
        for model in models:
            print(f"📦 {model.name}")
            print(f"   ID: {model.id}")
            if model.description:
                print(f"   {model.description}")
            print()
        
        print("=" * 80)
        print()
        print("To use a specific model, pass it to the Agent constructor:")
        print(f"  agent = Auggie(model='{models[0].id}')")
        
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())

