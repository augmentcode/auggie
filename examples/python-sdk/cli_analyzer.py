#!/usr/bin/env python3
"""
CLI Code Analyzer using Augment SDK

This program analyzes TypeScript files in the CLI directory for:
- Error handling completeness
- JSDoc documentation coverage
- Potential bugs and code smells

It generates reports and conditional recommendations based on the findings.
"""

from auggie_sdk import Auggie
from dataclasses import dataclass
from typing import List, Optional
from pathlib import Path
import sys


@dataclass
class FileAnalysis:
    """Analysis results for a single TypeScript file."""
    file_path: str
    has_error_handling: bool
    has_jsdoc: bool
    bugs_found: List[str]
    code_smells: List[str]
    importance_score: int  # 1-10, higher = more important


@dataclass
class Issue:
    """Represents a code issue found during analysis."""
    file_path: str
    severity: str  # "critical", "high", "medium", "low"
    category: str  # "error_handling", "documentation", "bug", "code_smell"
    description: str
    line_number: Optional[int] = None


def main():
    """Main execution function."""
    
    # Initialize the agent
    print("🚀 Initializing Augment Agent...")
    import os
    agent = Auggie(
        workspace_root=os.getcwd(),  # Use current working directory
        model="sonnet4.5"
    )
    
    # ============================================================================
    # STAGE 1: Discover TypeScript files in the CLI directory
    # ============================================================================
    print("\n📁 Stage 1: Discovering TypeScript files...")
    
    try:
        ts_files = agent.run(
            "List all TypeScript files (.ts) in the clients/beachhead/src/cli directory. "
            "Return just the file paths as a list of strings, relative to the workspace root.",
            return_type=list[str]
        )
        print(f"   Found {len(ts_files)} TypeScript files to analyze")
    except Exception as e:
        print(f"❌ Error discovering files: {e}")
        return 1
    
    if not ts_files:
        print("⚠️  No TypeScript files found in the specified directory")
        return 0
    
    # ============================================================================
    # STAGE 2: Analyze each file individually
    # ============================================================================
    print(f"\n🔍 Stage 2: Analyzing {len(ts_files)} files...")
    
    all_analyses: List[FileAnalysis] = []
    all_issues: List[Issue] = []
    
    # Use a session to maintain context across file analyses
    with agent.session() as session:
        for idx, file_path in enumerate(ts_files, 1):
            print(f"   [{idx}/{len(ts_files)}] Analyzing {file_path}...")
            
            try:
                # Analyze this specific file
                analysis = session.run(
                    f"Analyze the file {file_path}. Check for:\n"
                    f"1. Whether it has proper error handling (try-catch blocks, error returns)\n"
                    f"2. Whether exported functions have JSDoc comments\n"
                    f"3. Any potential bugs or code smells\n"
                    f"Also rate the importance of this file from 1-10 based on its role.\n"
                    f"Return a FileAnalysis object.",
                    return_type=FileAnalysis
                )
                all_analyses.append(analysis)
                
                # Convert analysis to issues
                if not analysis.has_error_handling:
                    all_issues.append(Issue(
                        file_path=file_path,
                        severity="high",
                        category="error_handling",
                        description="Missing proper error handling"
                    ))
                
                if not analysis.has_jsdoc:
                    all_issues.append(Issue(
                        file_path=file_path,
                        severity="medium",
                        category="documentation",
                        description="Missing JSDoc comments for exported functions"
                    ))
                
                for bug in analysis.bugs_found:
                    all_issues.append(Issue(
                        file_path=file_path,
                        severity="critical",
                        category="bug",
                        description=bug
                    ))
                
                for smell in analysis.code_smells:
                    all_issues.append(Issue(
                        file_path=file_path,
                        severity="low",
                        category="code_smell",
                        description=smell
                    ))
                    
            except Exception as e:
                print(f"      ⚠️  Error analyzing {file_path}: {e}")
                continue
    
    print(f"   ✅ Analysis complete: {len(all_issues)} issues found")
    
    # ============================================================================
    # STAGE 3: Create summary report
    # ============================================================================
    print("\n📊 Stage 3: Creating summary report...")
    
    files_missing_error_handling = sum(1 for a in all_analyses if not a.has_error_handling)
    files_missing_jsdoc = sum(1 for a in all_analyses if not a.has_jsdoc)
    
    print(f"   - Files missing error handling: {files_missing_error_handling}")
    print(f"   - Files missing JSDoc: {files_missing_jsdoc}")
    
    try:
        agent.run(
            f"Create a comprehensive analysis report in cli_analysis_report.md with:\n"
            f"- Summary statistics: {len(ts_files)} files analyzed, {len(all_issues)} issues found\n"
            f"- {files_missing_error_handling} files missing error handling\n"
            f"- {files_missing_jsdoc} files missing JSDoc comments\n"
            f"- Breakdown by severity and category\n"
            f"- List of all files analyzed with their status\n"
            f"Use the analysis data from our previous conversation in this session."
        )
        print("   ✅ Report created: cli_analysis_report.md")
    except Exception as e:
        print(f"   ❌ Error creating report: {e}")
    
    # ============================================================================
    # STAGE 4: Conditional actions based on thresholds
    # ============================================================================
    print("\n⚙️  Stage 4: Checking thresholds for conditional actions...")
    
    # Condition 1: More than 5 files missing error handling
    if files_missing_error_handling > 5:
        print(f"   🔧 {files_missing_error_handling} files missing error handling (>5 threshold)")
        print("      Creating detailed error handling plan...")
        
        try:
            agent.run(
                f"Create a detailed plan for adding error handling to the {files_missing_error_handling} "
                f"files that are missing it. Save this plan in error_handling_plan.md. "
                f"Include:\n"
                f"- Prioritization strategy\n"
                f"- Common error patterns to handle\n"
                f"- Code examples for typical CLI error scenarios\n"
                f"- Step-by-step implementation guide\n"
                f"Reference the files we analyzed earlier in this session."
            )
            print("      ✅ Error handling plan created: error_handling_plan.md")
        except Exception as e:
            print(f"      ❌ Error creating plan: {e}")
    else:
        print(f"   ℹ️  Only {files_missing_error_handling} files missing error handling (≤5 threshold)")
    
    # Condition 2: More than 10 files missing JSDoc
    if files_missing_jsdoc > 10:
        print(f"   📝 {files_missing_jsdoc} files missing JSDoc (>10 threshold)")
        print("      Generating JSDoc templates for top 5 most important files...")
        
        # Find the 5 most important files missing JSDoc
        files_needing_jsdoc = [a for a in all_analyses if not a.has_jsdoc]
        top_5_files = sorted(files_needing_jsdoc, key=lambda x: x.importance_score, reverse=True)[:5]
        
        print(f"      Top 5 files: {[f.file_path for f in top_5_files]}")
        
        try:
            with agent.session() as session:
                for file_analysis in top_5_files:
                    session.run(
                        f"Generate JSDoc comment templates for all exported functions in "
                        f"{file_analysis.file_path}. Add these as comments in the file, "
                        f"following TypeScript JSDoc best practices."
                    )
            print("      ✅ JSDoc templates generated for top 5 files")
        except Exception as e:
            print(f"      ❌ Error generating JSDoc templates: {e}")
    else:
        print(f"   ℹ️  Only {files_missing_jsdoc} files missing JSDoc (≤10 threshold)")
    
    # ============================================================================
    # STAGE 5: Prioritize and fix top 3 critical issues
    # ============================================================================
    print("\n🎯 Stage 5: Prioritizing and fixing top issues...")
    
    print(f"   Total issues found: {len(all_issues)}")
    
    # Prioritize issues (critical > high > medium > low)
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_issues = sorted(all_issues, key=lambda x: severity_order.get(x.severity, 4))
    
    top_3_issues = sorted_issues[:3]
    
    if not top_3_issues:
        print("   ✅ No critical issues found!")
        return 0
    
    print(f"   Top 3 critical issues:")
    for idx, issue in enumerate(top_3_issues, 1):
        print(f"      {idx}. [{issue.severity.upper()}] {issue.file_path}: {issue.description}")
    
    # Generate specific fixes for each top issue
    print("\n   Generating fix suggestions with code examples...")
    
    with agent.session() as session:
        for idx, issue in enumerate(top_3_issues, 1):
            print(f"      [{idx}/3] Creating fix for: {issue.description} in {issue.file_path}")

            try:
                session.run(
                    f"Create a specific fix suggestion for this issue:\n"
                    f"File: {issue.file_path}\n"
                    f"Issue: {issue.description}\n"
                    f"Category: {issue.category}\n"
                    f"Severity: {issue.severity}\n\n"
                    f"Provide:\n"
                    f"1. Explanation of the problem\n"
                    f"2. Concrete code example showing the fix\n"
                    f"3. Why this fix is important\n\n"
                    f"Add this to a file called fix_suggestion_{idx}.md"
                )
            except Exception as e:
                print(f"         ⚠️  Error creating fix suggestion: {e}")
    
    print("   ✅ Fix suggestions created: fix_suggestion_1.md, fix_suggestion_2.md, fix_suggestion_3.md")
    
    # ============================================================================
    # FINAL SUMMARY
    # ============================================================================
    print("\n" + "="*80)
    print("📋 ANALYSIS COMPLETE")
    print("="*80)
    print(f"Files analyzed: {len(ts_files)}")
    print(f"Total issues found: {len(all_issues)}")
    print(f"Files missing error handling: {files_missing_error_handling}")
    print(f"Files missing JSDoc: {files_missing_jsdoc}")
    print(f"\nGenerated files:")
    print(f"  - cli_analysis_report.md (summary report)")
    if files_missing_error_handling > 5:
        print(f"  - error_handling_plan.md (error handling plan)")
    if files_missing_jsdoc > 10:
        print(f"  - JSDoc templates added to top 5 files")
    if top_3_issues:
        print(f"  - fix_suggestion_1.md, fix_suggestion_2.md, fix_suggestion_3.md (fix suggestions)")
    print("="*80)
    
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Analysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        sys.exit(1)

