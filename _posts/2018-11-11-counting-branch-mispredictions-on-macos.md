---
title: Counting Branch Mispredictions on macOS
layout: post
tags: [blog]
---
{::options parse_block_html="true" /}

# {{ page.title }}

<div class="epigraph">

> Somewhat astonishingly, generally accepted "improvements" of quicksort such as median-of-three pivot selection bring no significant benefits in practice (at least for sorting small objects) because they increase the number of branch mispredictions.
>
> <p class="footer">K. Kaligosi and P. Sanders. [How Branch Mispredictions Affect Quicksort](https://www.cs.auckland.ac.nz/~mcw/Teaching/refs/sorting/quicksort-branch-prediction.pdf)</p>

</div>

Spoiler alert; it is rather annoying, and I can highly recommend using some other operating system.
If you would like to go through the ordeal anyway, I am listing two tools and how to use them, assuming that you have an Intel processor.

Why should you care about branch mispredictions?
They can be be a bottleneck of your program, and thus they can be worth examining.
At least when you want to squeeze as much performance out of your program as possible.
Or maybe you are like me and have to research this for a class.
If you would like to learn more, search for processor pipelines, branch mispredictions and their effect on performance.
You can start at [video](https://www.youtube.com/watch?v=ckQAlp7WeHo) about branches in pipelines, continue with [blogpost](https://kristerw.blogspot.com/2017/02/branch-prediction.html) about 30% performance reduction due to mispredictions, and who knows where that will take you.

Good news!
Your processor can count a wide variety of events on its own using so-called performance counters (take a look at the [manual](https://download.01.org/perfmon/index/) to see what is supported).
Bad news!
It is somewhat problematic to access the counters.

## Instruments

_Thanks to "that other guy" from [StackOverflow](https://stackoverflow.com/questions/33936834/can-i-measure-branch-prediction-failures-on-modern-intel-mac-os-x) for mentioning this tool._

To sample by time, you can follow these steps:

1. create a new instrument (cmd + N)
2. select "Counters"
2. File -> Recording Options (alt + cmd + R)
3. in "Events and Formulas" click on the tiny "+" and from "All Events" select "<code>BR_INST_RETIRED.NOT_TAKEN</code>"
4. profile whichever process you want to

By default, this starts to count branch mispredictions for all running processes.
Be aware.
Instruments get very resource-greedy when profiling everything at once.
The results are continuously refreshed until you stop the probe or the target process finishes. 
What I find quite handy is how the results can be filtered for different functions.

All of this seems quite straightforward so what is the problematic part? 
It pops up when you want to process the results programmatically, e.g. when you are designing an automatic performance experiment. 
To my knowledge, the results are always given in a proprietary format. 
Even when you run Instruments from the command line (see Instruments' man page for more info). 
If you would like to reverse engineer the format, you can look at Jamie Wong's Reverse [Engineering Instruments' File Format](http://jamie-wong.com/post/reverse-engineering-instruments-file-format/).

Instruments is thus a nice tool giving you all you need to count branch mispredictions in a program as long as you are fine with using GUI for interpreting results.

## Processor Counter Monitor (PCM)
<https://github.com/opcm/pcm>

You first have to [build](https://github.com/opcm/pcm#building-the-pcm-tools) the tool, but then it is easy to use:

1. run <code>pmu-query.py</code>
2. enter "<code>BR_INST_RETIRED.NOT_TAKEN</code>", the result should be similar to: <code>cpu/umask=0x10,event=0xC4,name=BR_INST_RETIRED.NOT_TAKEN/</code>
3. run <code>./pcm-core.x -e event</code> where "event" stands for the result from the previous step

This gives you continuous results for all the running processes.
Find info on how to profile a single process in <code>./pmc-core.x --help</code>

The good news is that results are easily readable as they can be output as csv file.
The bad news is that profiling a single process still includes activity from other processes.
As far as I understand it, PCM resets the counters, runs your program and reports the counters after your program finishes. 
You can verify this by crafting a simple program without any branches and profiling it&mdash;the result is not 0.
However, I think it is possible to get reasonably accurate numbers using a baseline.
You can first profile your program, and then profile the whole system without your program for the same amount of time.
Finally, you subtract the numbers, and you should get more or less accurate result just for your program.
Since the number will never be completely precise, I think it makes sense to take multiple measurements and average the result.

I am rather annoyed by the need to baseline, but sadly I have not found any other macOS compatible tool which can be controlled programmatically.
