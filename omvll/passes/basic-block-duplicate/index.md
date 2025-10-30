+++
title       = "Basic Block Duplicate"
description = "This pass clones basic blocks to introduce redundant execution paths"
icon        = "fa-regular fa-copy"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-copy" >}}Basic Block Duplicate{{< /hicon >}}

{{< pass_purpose >}}
This pass aims at duplicating selected basic blocks and inserting a coin-flip branch
that picks, at runtime, whether to execute the original block or its clone.
{{< /pass_purpose >}}


{{< compare "svg/basic-block-duplicate-1.svg" "svg/basic-block-duplicate-2.svg" "omvll">}}

As analyzing program's control-flow graph is a fundamental step during static reverse
engineering efforts, this pass attempts to introduce noise and redundancy by creating
duplicated blocks, for the selected ones, and jump onto the original or cloned versions
depending on a runtime condition.

## When to use it?

As for the other passes, Basic Block Duplicate is best applied to functions performing
security-sensitive operations. Due to the significant code size growth and noise it
generates, enabling the pass with a low to moderate probability is suggested to level
off the overhead. For increased security, it is recommended to activate the pass in
conjunction with other passes.

## How to use it?

In the Python configuration callback, enable the pass by returning **`True`** to
apply everywhere, or enable it probabilistically (at the granularity of basic blocks),
as shown below:

```python
def basic_block_duplicate(self, mod: omvll.Module, func: omvll.Function):
  # Select basic blocks with a 20% probability.
  return omvll.BasicBlockDuplicateWithProbability(20)
```

## Implementation

The pass works in multiple stages. Each selected block is split and cloned into a new
block, and within such a new block, all instructions and their operands are remapped. The
original block terminator is then replaced with a conditional branch that uses a runtime
coin flip (via `__omvll_coinflip`, whose routine is initialized once per module) to decide
whether to jump to the original block or its cloned version. Afterwards, PHI nodes in the
successor blocks are updated to account for the new incoming value from the cloned block.
For values defined in the old or duplicated block that may have users outside of their
definition, the pass may insert new PHI nodes at the merge points to preserve SSA form.
The toss of a coin in `__omvll_coinflip` is implemented using `lrand48` routine.

For instance, the following basic block:

```llvm
block:
  %val = add i32 %x, %y
  br label %next
```

Is rewritten as follows:

```llvm
block:
  %coin = call i1 @__omvll_coinflip()
  br i1 %coin, label %block, label %block.clone

block:
  %val.clone = add i32 %x, %y
  br label %next

block.clone:
  %val.clone = add i32 %x, %y
  br label %next

next:
  %val.merged = phi i32 [ %val, %block ], [ %val.clone, %block.clone ]
  br label %continue
```

## Limitations

- One may incur high performance penalty due to the overhead coming from duplicated code,
  in addition to an increase in code size.
