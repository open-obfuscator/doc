+++
title           = "What is the difference between O-MVLL and O-LLVM (and its forks)?"
headless        = true
sitemap_exclude = true
weight          = 40
+++

The main difference lies in the API and some obfuscation passes. While most of the LLVM-based
obfuscators rely on in-tree obfuscation passes configured with compilation flags,
O-MVLL is different in the way that it uses out-of-tree passes configured with
a Python API.
