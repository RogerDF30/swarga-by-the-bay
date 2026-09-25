/**
 * Swarga by the Bay — consent text shown on the check-in form, and the check-in PDF.
 * Keep CONSENT_TEXT in step with index.html. When the form wording changes, copy the new
 * text here and bump CONSENT_VERSION; each check-in stores the version it was signed under.
 */

const CONSENT_VERSION = '2026-09-23';

/** Swarga logo for the PDF letterhead (PNG, 188x112, flattened on white). */
const PDF_LOGO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAALwAAABwCAIAAAArAY0zAABMKklEQVR42u19d5gcxfF2VffMbLrbvXy6rMunU84ZEIhojBHRJhuMAJtsMNiIbKINGJMxmJzB5GiTo0Ao55xO0uW4YWa6q74/Zu90SlgSwub7Wf3so+e0uzM70/1O1VuxkZlh79hDo2cqEQAANAMifN0O16/W91TLYh8gMAAkYrFAKMikEQUzA3DySARE2XMyJg0AKCSgSL6lbDR8AABMzNT71xBF8hyIP/RtGntXeg8OBIhqeLsJ9k2HbAsQwCV4sh4aNa5OUIlPAAAiBIJB8KDChEIyE0qp7S5KdJCbiK2fnWhYprqaUJqs3WDhYBmIJOqXhEpGJTYtMtMKgoWDrfQiBGDSgAJRAHASfABaswdf7DX2guZHPa5fA1+0wOfN8OcaRkSHYVkCSGAHASIwAzMDEQCjkADodmxsnvFcx+L3jEA6CBldM4OcKBoWK8c7Ycu3z3VDUiAKZi3MoJGSFa45IGv0yb6s8s3yhQmYpUAPNERMzIgohNizuNkLmj08Whwghq874dlGPDEXvu2EVpdNtlNBMpjMjIgoDW13JeoXty14q2Phu25nE6sECoNJAQAKA4WBlgFM3cqLgAGAmTUAkBt32+uav3q8Y+G7MpRBju3LqciZMDVUPAyAmRQKiYhSABNpTQSwZ3GDeznNnh0LovDb5dClgTX/Ig+/icLiGFRaiSf6+4lZIhLpho/vT7Stzxh4WHTN102f3K+1K4RkUvDda9G96igMQATSABIAWbuAiNLMHHVSxtCj/Hn9EBEAkxAEYBQMe1JP7QXNHh7EMD8Kt6+FRTZoTQAgEcpEdHImiq7GcLTxyKGD6j9+ENlFw9/01cO6swmF9HgvAAjDD4jkJjxakiTCAKxdK6M43O8gp3Vdx+L3gVRy/QyL3eTfjJDSd5TwhcLV+2eNOomZEIXHpokBhRBC7AXNj3FoBonAAJeuhE/bk29G3M40Hc2Jrqix2sbSxvDy92Orv2I0DAnk2IwAAL7M0oKf3SCkufaFC1W0RZh+IyU776DLmFwjJQcQzdRcK61Axds6lnzYMuOZeN0cchMAkDnqFGmFWmb/w+1qRGEAAJPqc8CFKSWjQn1HeUwKgQEFoIA9IWz2gmbPD8VQ78INCxvc9jp/KG0D+/t2LilpnJep2qy2NWmtS3Pja1CYGoFcx0AwUrJSK/cJFA5OH3JUdNV0Zh3IHyB8oSS5kYYHBY/UoJDAzKSc1rXtC99rW/CWP7Msa+ypgYLB7fPfWf3iNKKYAAeFwVqHioYWHXmDP7eKiQAYUKAQ3Q6BvaD5cYwEgV/AjE66YJ2obJgxSa1cHTNWhPocFPu2YPrfQ0KHVBxAIZBGkTP5Yh3vMALhlPLxgfwBaFisXZTmZmbTIxWSjLjHTMLkR8zM1Ln0w+avn0yt2j+1Yl9tJ9oX/wso1jz3Vad1AwCwS8VHXps95hRAZK1Qyl6OpL2g+a8rJgAJYBOcuqCrwdZjGj8e1/T57OaYyi2Zkm+oL17CRLup4iwwUjkuY/yvgoVDpC9lS+cgb+Hz2a7/kAiAen2MiIJJda2dmdi0xJeaGx5wMCu7Y/mnyx7/FQphSZOI+kw6L3f/83t+5Xu6Afea3HtsSADNUGfrlo6OVDde67OL2pe78Vi0od5nZDJ5ljOVn/ZoqHzi1kDBHqD8m4VEIQEkM5PWIunV04AYKhycWjqalM2kSdltc980hATpc90EgI6u/rptwbuRmgNQGkl/0V4/zY9C0pCSwigNiNPj/7I7WjIbF8QaV2f5rVC8vXHpkpB2UguH5R1wfrB0eBIt2gEUmPQNiyRRTX4UR2EC9Ggi3Mb6RmkYnlO52+yymLSQFgBIX2rW2FPiG+YlGpdLXwo50VjdHGN+uhXJCxYO9HzF30fD7FVPe24wk3Y3fvno2teu9FsRIVAIycImdlFwsGh40aG3+PtUAzMgJl12KAAw+QdrjtdTxxKObdDRNdy1BoQEZpCWSClHIySzx4AMoD8LjRBsDlFBMuTFkBQhiOQmhOEjN772ufPbF79PTGhYoN38Q67IHnsqICSZNYq9kua/P2LrZ21694+hQFAIIVCAJlKALHIPvChz9C+lLxUAiEgIBG2DEQBg0HFV/7Fe/zY1z2SnFUgBuYRbAgIAUKL0gfBhMF+m1RqFR8ic8QAAOgEoQJhADgsLEYFJGD4mhdLKnXxR1+oZVjib7KjTtq5t7suRfvtb6SXMjCj2Spr/mnhJ6g5mnehY+dDxsU1LpGUyg9AslGLGUPn4olPuE74UJo1CAjCQAiBg0E3T7fk3cXQtunEABGECCiCHgLb9pWQUWwYIFDAZRT8z8vY38g4CYQAwkANMIHyAgrWDwmTSgNg+782O5Z/HNs5LbJyf2nekP704UDI6MvBw6Qvtts9mL2i+jzrqdpoxA+LGN65u/vppYgCJwAykjUCk6Og7Uqv27baQdVIfAVDb/MTc67ltPmsbWAOIHqKLZlhEKtGXhb5stCLAmnUC3E6IrqfoWo5tBGGiSmiBLA0jb7JVeZYIVyCagBIQk85iYXoZF6zd+KZFZHetfeliHW1KG3hEdM3sYOnY4il/3C5b2queftiBAMyEAOTE22a91Db7ZdIKhAmMTCpce2DOhLNChUO7qQYASiDFTrOz8hla9QjZHSgEMAEwBnKN3Ikic6RILZeRfiD93UyFe3lrmHWc2xbR2pdh05ecWKfIdTe+Tw2fQqjEX36qLD4GWANKYJ0UgcgozUBef0DMGDyl4eN7naZVuZPObZ39utOyzsoo3j1/zV5J8z3EDAJrBQCdS95f+/x5jFK7tpAWsGvlVpWd+JCVVtgtkDyWqqljaeKrX3FsA6AEJhAmpJabZaeYufthoM823FZ7YW0E9EgrM6EwAYCddmqdlVj5GDV8bmhFiCQMs/AIa8AfhC8dAIBcECYAejYaEMXWzVz16KmsXX/BEBkI5x9yub9PzRYadi9o/hOw0QqFdDvqVz38C6dzo3JsEBKFlMFwxenP+bPLk0vCDChAx9S615yFf2a7GYQJKKU/16i9xCg4BFCCTjAaKExmBUyIckv7yMOeAiYEAcLoXmam5m94yd+cTe9rKZlIWiGRe4B/2C0gTCAX0ABgz0WE0tjw1vXNXz2mlZbSzP/JVSkVE8y0fGH6d9kjdc011+xd/90Y5CYQBaKse+u6+JpviJlRAruIkDNhalr/Q7sddwwoqGuV/c2F7uonQUW9942in/lG3yPTBibtXmEiSs+owaRvhrd4MSMwIioNQgBAdywpWCAKDuVwlWpfxG4HKdtuW6Y7V1iFhwEagAgoENHLD0wtH8+kY2tnMmtyutIGHY6Iwgzs6r2Lvcu/e0MYfhSG3bquY+4bzEyOg1oBsy+zb86Es4A9NwwACtC2rv+Umr9JigdhWoOu8g27Ba20zQQZGCiGoCGpyAiYAcTmF0pAA9AwTKOHTQNrYAKUVuHhKfu+ZJWdCmbYQI317ybmXMM6llRziEk1J63cyRcLfxgRY2tnts55TQbTvdyJverpP6KctEIhVj11TteSfzEITa4QBrBbcvzdaQMOB+CkbaITjNKZPtXZ8BEAAUBg/N+NPgd4/BdQdtMXSuojVhBfyJvuAmctixDKVDD7QMoIMDIxdSKguRXv0UpLid2eOqT2xbHPT9aJFk3kLz8pOPgqAEza5AysXZRG+8J3N7x8iWu7QKrvKQ+Fq/ffC5r/HKVpmvHMhlevEgK11gSEAOHKCSXH3yP9qZ77n3Ucpd+Z+Tt33eukbDSCgTH3yuyxAADCSsYdyQZhge4EeyXE53NsFkS/BbceyQa0gJOZwowAZg4Hh2H6kRgaCzKclE8outUFg3ZA+rhrVfzzE1V0IxMGBl5iVZ0F5IKwkpdEGhFjGxesf/7ieMOyQHZZxW9eF2ZwK58NMTBCTENMc5aJCCBwr8n9veBCgIKZoqu+FsgoJCsXBVuR/MIpt0p/apKm6DgKnzv/JrX2ZRYmCPQPu1bm7rNZqHhyRfgAEDb9lZqeVk6X5beSX8g4Bsw+gAY466HtFQQNqgk73qPOj1gERORnkHcJiFA31yZACdLHOoHBAv+o++Jfno6qw1l6j1F4uPBlASsQFrkJlAYzBPMHsjCkL2Q3r2md8VzmuNM9pg2IzDAvSgw4MITvt/HnHfynUuS9nOZ7Y0YzKadlbWz9bETUSnmZL3kH/s6K5HvuG2ACNKllplrxCKMJ5FilPzcKj/ICAt08BoGJN97Iyw6H9rcFsuWLQGgCpB8NwVHAGmQEIodC3mWQcx7kXAwVr0PGyYJY6DZqeYJWnsAbbwK3DroNcgBCYYGwRNpA34DLNDFoW61+FqQfWAOAMP0A6OWP5ow/Q/jThOnf9K873Nb1pFU3AYK/beRfLyWb4f12tDUBbB0U32s97ZakAdz00d3RFZ8JFCwQkfvsf2HawJ8KM5BM+RaC3Q4142KymwEA0oYGR90FKJgVogQgQMFuk173O2j7B7sNTJ0Mms1MiOyP2WdB1qkQORhCw8DIBOGH0EgIDQcjE1L3IWrS7nowIuCs5MRctNdieBKgD1h1kyQAYEwp1U4HtM3l6Hqz7MRuHzFAd9TJn1NuBCO+7PJ43cxE44r0IUcyaRRCAJT5YUGMH63nJQks84FiSBEcNnCvpPk+nmBk7bTPfwe0ZmYmbaUXZU840whldk+qBAC94jFuX8hoAJOv9iIvruQVtgEI0J16/ZXU/h6AYBnE/Cs440hR/FeRfQ7IsFe3BKyAXWDdnXUlAIXIv86o+kiU/J3D44Fdis+ilaeAvRLQ2OwVBEAjGOh/KaYNgXgDrX4GZKCbPCMReeZfpP8h5MQLp9xqWH4VbUXPpQRQFRI3lslGFwzExV3i/jVik4N71dP3xIyIb1qkOusASZPL2k0fcqSwQp5Zm1w2t4vWPM/MoG2j4FAzexQAK9dNLq1qVHXXcXQmoCIZlmVPi6wzZN71GBoJwg8iwKyBvThA0tKGpLtPAiDIEPprjKJHMPMocjfq+DxYcyrEFwAgkNNttGuUAd/Ayxm1veIx9gQegBDCAw0KKQOR1Jr90QpmTTwHlI3SJCIC6FBwyUpV6OdTc2BgCr86FIaF94Lm+6JGRFdOR0QQBjMhotu+gbXbY1UBADV8yolGZhYgrKpzPM5hGJS0k9f8llpeZkqASDEKb0RfJQCiCHZLFESUxEiMACKZitXtAgYgAAHsAGiRd5uZexLKMLj1UH8dgAZEYAdYe+k1MmOYzB6ho6t184zecqjnD7dtfaxugb9Pbednf6dYu4enrzrcZXF1QBoemwV5Pha4dZRhL2h2Z8TWfQsAxAzMXqYtCokowauNBdBrnifSAGTkjMZwJSSFkATW3Pmp7vgI2AUr0+j7IIRGgwh0O1rEZmBur0yJiJUiAAC0kj6bnBswso/Lkjq/4c4PASQwJX3BgIBCZO0jhKCGD71kUwAwDMMryAIAM7NERTcBYjTaHF/9jWmaAmBCWP6tyndmH5lmwHmFkhiIgfeC5nsFEJSdaFiBwmBmBAksUsr3AcBkGwchqW2hbvoGvJzv4qOTuRNe/BkN3fo6ALAMGgXXitQJKCO74IYWwjCMRCKRJEbsAjNmnGWkjkVhYMtdQJ2AZhKjiABoFB0BwuTGzwGTEfXN8Q0AYQWjjauAKTLi6M6GJd6bfokDgsJEUAzEoDy/oFJJMrQXNLsx7IZlbrS+OxUc/TmVvuxyr4jas63U+reYNQCL1FKRu9/mtE4AUE3c8S9AFuH9RMr43bsAn89HxERemIJEoBpyf4+ZJ1LXUuj8qLsoTgIAkysCBbLoGJ2o5/gGgGRKOQrhgcdMycmoPaRr5XS3vb599mvAAMzIbAkQCH4BxCAQJKJhGD2Sby9odnk4bXWgXYEGgkQhrcy+ZrgPdFeEcKzOXfmU96xjpD8aoW7Vw8CaO79AtxkAMHWf3UicY+YtPfgeNWb0l0Pu70FmQMsjPXkOzOARLyNrFLDSXSt7koIRkzzFTMnKHnWiFc5teu8vqmVjdM233bHS5LDEdiCyFzS7PNzOei8HRSCwVm6sPdGwbLPyaprOugtAowCROSLpHUlyT43tzxuWtCy/DFTsxuT3VCp1V/P3psmIwaGQWMaqvvcRAIDpQxkEtS+CXoczAzN5HW6EFQxEsvwlgxKNy8FL3+keikEDEO8FzfcbOtZGWmutEcCM5IerJ6G0mLsjlMJEL/gMILJG9awcAILuBKeFydAiC8zCPeBl7C130MCUCUDEzuqtWnKJUIkIlnK0bhv8oTBMAEisnK6cuDRkdNP8zdcLoBge30hvNpLAvaD5nkTY7uhxrJOyU/qOCPSp3vyAWhkoBABgIB+DxVs89LoddD1iAoWBZv7uoeQ7PlW6EVhDYjWw6i2WgMlLJAVmTiboJFtluVozczRnwELtb3Y61sWd3pLm9vX8QJ1+fhPtVU/fWz11NDB5ERl2OxuNYEbvPCaOrfcQJYL5IP2bEYMSnJVAzSDk7lFgItKkd4QbZpdkOqQeBg2P9GRQUDLtwpXharTStwUfCwMR10Nwrq8ob59zU6oP4KTZBQ0uvNECCmCTonbFe0HzvVSCijZvlh6GlWhczp4LxKOQqsPrxgjSvzXVjS8GkiBzOPXAXf5ZYBYgpEQhALH3KynzmEVwIDjz2V0HFO+lgxiFKdIHYbCwO9EYsPuoTs3nL2q7ZXWia9DRgaKRdqQ8mdEMMDcKnUSGZBtgk70FaIwfwSr0sgm81DbPXfbDd6ncraslFBawN/uMAHbzao9XJi0WM5w0l9DYopYAAJxlIBBEEJO8GHceMcQMABpIAIotZgYBkIEFCoWGBpeNFFDNYAW3kA2plZSo50Q9+LIg6eQBxfDwBvg8Gg6FUtc4mSmNxqUl5T3T/mUHBwUkFBBD4ocgwrzFyu8cnSRyNTkuKQ0EAoRAKVAIFIIRGZEYtvRD/liG8Kf23DMK0bn0k143zuBGkzxUyCRikjmdNsQWgbIpvvY7OqVt+y4BayYAcFk3qq6nW75Znmik7odsWaLx2Za5Ly9/NJFoNv0D2VcofXk9qVvdCGAwAonZVzirnupOOgYAkAjNDgQs4bKLUrzWQLM7N9d2LopBXAOCsIT0bwmTPSNpegrKt2yjsh1saeIkTxTCa7MgJcRiurGx0XVdBp2bkxOOBL1HiL2OcZsdD/wdVuju4l0BCgDtOUh71Y/hju7UCucJaZKXWsuEKFBI4G73hhlKihwV7ZXTCQAGyLAXegIZARTJKNKWiMFuuULAJsoYOT40CPi+xo9faZ0DDFWBPvc2fHJc+rBWnZifaPyqc9Xk9Jpb8/b3WRFWTSCCrDvQV7o1R97wT9X4JUo/Am4mwgBTsuGTZQkSSgrTZt/1a+CpWkiR8Gk7LIuCAMHMqSaW+vEHUU9J11Z3LGYbucKaGVEQo4GgFCxeuPyDDz744osvFi5c2NHR0dbWFo/HGUlIiERS+/Xrd801V++37z6UDOz+cOrGRgwBiO5+0S1ALhhZgALITqbVbXGfwkwrwO6yWSZtNy1zO+rNcG7SeS98LBAJtNNismZWKANJ6PgrIDYXZDq3v44pY4BdQN/mKdJaSgkAiqnR7Zwf3zAsVJxlpDDwfY2fvdUy9/zc/UaE+uaZ4Ts3ffBc/ZeHZA+b27Xu/Oxxl+YfKFEA2xSdLymOvvItsEgahOGsfQGEQbENyZhG9xicihf3iU1fNm+Dv+9S7FMH5tlLRYkfvuwAE8FhMAROzUPrh5A0SilmNk1zW8RoZq2ZSUgDEWHmrKWPPfbY+++/v2bVaq1drXVPVKW8vKqgOE9K3Lip7ssvv5w8efIzzzxz7DFH7wiIewbrXsYka45+CdQJLU9D10dglUH2+Zh+9HYPMcI5nsxDRGBW0dZE0yoznOvVN6EvK4mnRCOrLjR7hZbCk6H5WXA3Qvt7nHshGtmestCatdaWZTEAMc2Orr1y/as+aQLgs+Vnmihebpt9bu6+U9KHMjACnpkz8bd5By5LNPyzbfGl+QcyMDEJQGEUQHQB5F++pTY1KLZBN88Cxt5OOm9CAwKOLkj3zVj0mZYbMksSzItjsDIBLnliHlIkpxqwIAptCgRypgGFPtwzoNluSFZpRoEIKAXGbbj9jnufeuqZpUuXIqLjxACc3Nzc4cOHT548+aCDDqqqqgCGnstZtGjJ2LFjpk2bduwxRwNisv0u/iBp8KyacMNvKbFC5N+IhXeAswoabocNl4Bugawzt/1+ILfKTEm3O1t7+su77Rs9uorgZYwDILKKUutcmbvvZuUTGM4ihNTF7iZqfkLmXuxRUinBkzEJcgLCeqtjwSFpAy7sM/mgRXccv/qhzkQ03QwdHOnvCSETZUhY5GWaC2h223OsdAAGsMBeBmxDcMxWLJvjG9hpBhQiUtWLmzMn+6+R2TBHr16/7/ii6ba/KZCjOYkYn4AuDVevZoe805FPwNQ8scdA01vMCiE5+SBCXV37VVdd9fLLr8bj8ZSUMCn2+32HT5l84slHHX744Ybc+gIUgRBQXV3NDIFAQJEyhIQfUthw/T2YWC6rPk/yTuGHvk/zhmtxwx8hNB4CtVt930zN4Z7uMih82WXJKifP/RqpFb4+YDeStvXGd2TOxM11KjIVwvtB+9sCtO6aDtldIFIAIJ6IB/wBDSRQJMhtcDqGp5cAwB19j/+sc3nfzKyDIv3WOa1/2vTe5HDN8FBJvpkmABPkApBgz2DQSFGuv5l91cLqu2V/NdCdKwWgkJZMLd+CUDAjoBtryal/b3DGQccOyrtrecsrNjicpMk2JcNmEpN2uGK4dwOJPU0RAFAqDUpB3fq2E084u6ys4vnnX0xLS2PWDPaFF52zZu3iF1588sifHWVISymtFTEBEynXRfDKB+Haa6+NRbvuvfdeKSQz76kGuNsTVEokPoWscwCAG+9Si0bqdReD7sS8aSAzoPXpbQ0a4UvJHHmiGcn3Aj5240oUyKS91Ag0QphS6vEb3fgZcC93KhqYeQqwZgBOzGfVBAAEOuAPeCRcAHboeD13jA2VAUCVP/fMnImTwlUIaKFc4zRetP65F1pmMLPN6tp1L+8bKMnyZXpPFNffTLpTlNy37QVT83RENAwD04dsxfGZ9cZvnmuELCwZHfBZ2gxoAEsAAmtmr6BKM3gpNZoBAA7OwD3pp1HEwEgErgOXXTbt/vv+lpaWVlxUumFjXV1d3bQrL7/s8t8aZjJYBgSIYBlmb3Hl+Q+efPrZW2+55aGHHx43doyjHL9h7YwTfTdHfJHqWGIUTQR7Ja27GEUQ4nPAXwG5v4PQQEjM2+5BuZMvSTSsbFv4LqIklXDbN3lZ2R6HgGAxwJeCAeMN1PKtyBqz+cjQGEjdFzo/luxC9FuwSohZINjktut4q45fu+G1n4QHphtB7ra0/9Wx2ETxcuuso9OH35V6wvJEwyvts+6u/yCdxcUFhxFrgQggsWu6yLsWkjypFyzsJmr6xrJ8rpETyBy+jWp21sx8s81Xktt3yMMd8IYbNhESBANDIBAWRsEn4dYyiGlscKHAJ8r92Me3i0TYWzYiklJuZSsqDShQIDz99EvnnXthV1estnZAfX3dylXzz5x65g033JCekQIIzBoZpJBbeYh6vAf33HPvDTfdNHPWzNp+NQDgM0zs9evbKqldosnbfpmpyzAMoATrOCkLkcBII2ULYNBx0CqZPLWlDRWvm5uoXwwMIBBYJOqXAJPn8QNgo+gIZ82zKAzWjtrwlpU1ptsPy8AaC27Qyw8H3S5bHuf0Iw00NNOdK15ZCm3NQh8arj01a5xnQPiEoZmXxDfetvHdISnFd2ee8LfGT19qnRUQwV9mTDole4QXPQAwoetToC70lQIQMPbui0YtMw1db7uOWbQPWpGtOpjEG5bPp7RF2eMjlPreKi0ANAsBfFmxCEmYMp9dDUvjeGLOZvbMvOvWU0/61pbeJyQC5cCUnx3z6aeflpSUaq0XLVqwz76jH3vi45ycHMMwtFamMHDrZgjJW/Du4vGnnlq+YsX6desEAjMJ3Do/dUe42RXdtGU/VV8ZCINaXhT5fzCKb6H6J8hfKwquBHcjxOdA9nmwpZfICxUE8gdquwu7fXes3Y5F/4oMPMzLcpIZw8zCw926dxGEbviEnVa00hE5WaBkFWPuJbDpOkgsmBV7bWhwyhPrPwtF3YeGnBklJyQsT8B80rW0wpczM7b20+iyywsPi2l3frzusaavLs875OBIrQ8NZgbQiBLcDbDpOsi9DAL9k+nosPlfZ8WjSAQAMv8nW0ZDHBBGw/QXVwbK5tQeLSgCCmKugyhLgrImCDbBkFSc2wWPbYL906DA9z1M7q328yAABSgQ/vnel8f//FjDMCqqKhfMn9unT+7TzzxyzLE/5W6vmZTGjn08gAiuq6dM+dnJJ53oZaVJsUVAXinlMZvN5u6uuZEguWweY0VM9qWSWZB+nGh5BFKGYu5ZMvdsiQaoJlh3LsgUyDxhR90Mg0VDOxZ/wNoF4Pb5b9tNK8P9DkAzCMAgfaJoCq99A6XBXWv1hneNvj/fbOqyEpmnkLtGNT0Q58Y4uYuchluGnAAAPYhBxGdavv4sujyunduKjvtZZLCBUrEu92UhoA8NBmbQAgW79bDpCsw8A9KPSi6Id8GsAaVu/Ew3fQkAMnc/I2tUL82FaPjaV05fPPufVHGMPxyOx4kRU/wBh2FEBDSDT0BlwItAwbttcHpuUtQws9jFqcdtEAMIcOONfz3yyKML8osLC4oXLpx/2mknr123zEMMAsgd56h5MsZ7GYYMhUJaKwFo9EIMEXlcWGvt/Q3byWHbKcADM6DRnbRrJ7sx5P8RUifay892Fh8IG6/gNWeoBaPcrm85/zowvFKm7Zj6gfwBrF0hvRoyTjQsj29cyKyZNDBj1hhIqQAAgaZa+lCyzx5trmcTfa4UqeNNtr7pXFOTlsygWGM3r3dbEfHF1m/nxNefn33A+JSKdhX3xK2B8qDIgGdbZjMTMglA7viYVx0HwbGQfnz3wyB6fMusuuw5V7HwAwiz74m9eQwAsFZs+OLpfZU/bIO00UQpPCWyf1rSdKoMgM/jabyHApYESTp9zTW33HLLbdXV/eobNkSjnS++9MLPjjiQGJj1tvplCztrS0kAAHJ7AskTMN5mV9Q9vP/uJKHpSVgDYGh6G5ofV2oZBvuJvD+grwLQhKJ7fJnfcvOj1PkZi4DI/RVmnIhmIVMChW+750wpHYPSYO0ys1c62fDZQwWHX22F8wAYhWUUHkpL72Hhg65VzuK7rZrzgFwmjcL0xICdd6vP2Li2rWuAvw8AaKbp0VWPNH3GCOud1mfKptb6845OH/ZW+7yvoitd1i6p99a/89NQFQOBWwdtr6FqxfybIGU8cE+worsoGNCZ/0cdXQ1EGOpr5B2weVsXaQJiYuOC+a9dG3PdjGCKSdiRSEjLQoMPj/DIsMEAloDDMyFV6mYXfpIpeuvo7wUaJrj7rodvvuG2wYMHL126NDMrsnDh3MysAAMIILE9+rLNQu6OF5GZtdZKKY+P74KqqnsI1r4K5ScZqTXc/iqsOg6KH4LQSBBBSJmAodEIoqeyFQAR/Vtxpp4mwMHCwVYk32lZi8LwbG9y425HnRGICCsIjGbfY+21L2OinlG6i++U2WNk5kgk1+tCwqADVslgKFmFc1K6tdIxGcM7deLOhveLzPRvo6sHBgqWxDc92PBxnhnxCaNLOz+1co8vP5YoqtedbfpqIHIUpIzfok0JGkAuALgrH1frXvFyk30Dp235uGoda1//4u8SsWgot/akMZM2taBtmIUhcWiGPilnc/2thTA5XRJvjsbxjgTvTiKGABYuWDlk4PDyiuqOzrbsnLQ5c74CAMfVPlOS9jbtxB5qxgBbdh/A7SLJ6zUGDN+9qVXv+Oi/BU3yc2c9LD4JKh9lfwlEv8CUCVx/O0S/xbKngFWv9uC9LQXe4dmYW759Yd0/LkNhMGtGRF8w0m9S7j6/CWRXeU1A1Kpn7NlXgQwwxcnKSZ30EgbyenemIeYliYZWHR0dKvXu4oQVD/0ya1yVP/cXKx/4vOb3L7TOeK99wd9Lf+mJIomCmUg3CbRQhLqzLwQAkyYhpZd4o+retGddCsIEions/QOjH+gVNwUmveHtG5o/f8z2pWZNnNp30jltiptc7huQxGyJ5I2LJAdMFiT0nvbdcZp5SYMIcP55F4RSIkzSMMTnX3zohQ5MUwKAkBKl1OSlPSAIkSz/+s6BKIQQCAJAeCkBmr2tGHm78dFd2y0tOpv8+RAocRYepJYeyBuvxZwLIL4c7NVJotPrVEopL6C2Y8WKGcOPSxv0U2aNwkAhmLTdtDaxcTEpB0AAk1F8tFFwKKNGaRh2U/SLM4DcXu3sERGr/DlhGahz2wBgeteqdU7LiFBJX1/m02VTFdB+qTWrnZZ1TquXZsTAiEIaWd2IoR6eLqQEcoBZN39jz/wtsAZyQAR9NRcCE/S0u2Imu7Nz6QcAmA5cPPoXAJBmisqgNBF8Ihnl91J27ERCa01aKaW03pw0uDvqiYEBMRa3v/7my4KCItLxzMzMk0+cmpeXV1FRkZeXl5GWZvkMy/JJKZVSjpPwmCwS204CAKSUyiVv5yJEJCaf5QuHwykpKampqSkpKeFwEA0BAF5AU8rupqq4BW6SZcmI35GtsfmyjVSALmANbgeTSZokdSDGQab0zlLwjtrKEbWdSSCFwuhzwIXti99nN86IDG5s40IdbbFbVgdyqgAFCMMadgt9eZpqmsFoYvuixCcn+sY9gFZakmEwAEBtIO+99oV/rX+/gxIHRPplGCGHdYmVKRBzzdQSK/PLrlUFGWkC0HEdy7SSdJ57GmltLtrVzdMT008H1AAIoH1DbxVp/ZN7L3gqwo3X//PWRPN6wZR+wPnCF8QdC3Ip5XZ98bsDGgQkAJ/PqqjsO3/+/D59+iilPv14BhF5afpKKa1d8jLye+ZmO2lG2/TlRgIAzTqcEs7Ozi4rK5swcdyhhxw6YkT/pCG5ZSqcx292ImeDAQBTx3PT/dz6qq//G9TxsYjsr1edLVMmgJHFrLwtsnuLrn97ZmayMkpyJk5t/OhuzVqCYIauZZ9bmSW+tELhCwEgSp9/zMOxL39FbfMsNEXj1/ZHR1mj78ZwtVfGK0Ew8MGR2gS5V9W9uk9qlcvaCyR7iTXtTkKiIGaBGI1GzYhJBEIA9lRMMnt9KlTdW/asywA1oARh+qovNvIPTcbwGRGBnHjjx/e2fPM8KCeQPzB99InJXb53cLO93Su9v7C7nIaBEJTSF1100aefftbY0Nrc1AFbsxYvnUMhsGVZfr8/EAj4/T7LskzT9Pv9hiH9fr9l+UzTTCIaSSnV1dXZ0dHZ1NTU1NTkOI736dVXX33ZZRcSbb2l3o4ys5jZdV3LspgZQQEaAAjOKmh7Gcw+oNuh4wMwC6HgBkCTvZp72oUkL0Qg5Qppkhtfeu/hdtMKRAkMwgiQ6soadVLe4dcyaSEkCMkq0fbNVKj/zNIC0iqt2ouMPgcgSO95QkCblEC8Y9O/nm+Z0c/f5+C0/gdH+mcbqTdufPvjzuVvVf6GmExhEBEwCyk3P35eazRynAU3uWueAiaQAdBxs/RX1oDNORLkxoXhb/n2+Y2vX+XaccMwSk5+OLV6Us8UYncqwc7gYfeTDQjAcZVpGgAQi9ubNtW3t3d0tnc4juO6rpcgEgqF0sNh0zQCgUAoFPL7/ZZlSSl3yEMQmFkI9CQKEzQ0NH7yyScPPvjQhx9+3Ldv8YwZM9LSUnoT1u8ATa/15i3of2IpRL8BXymExnjbnwCA45JhGLsEGmBmrVCarXNeWffSb5GBiIgYBUiE/OP+kjnoZ95OBV4pfsfMS4zm6cEDvwAAJhdQIBoxcgLCdFkbKC9e89zolLJxqeU3b3hnpdNEyD4y7ux7fLkvGwAUOQbKXpXhAlAAKdXwibPoNupcgSLp7LaqLjArk60qgBQDoDDiGxetfvR0p30TCpk59uSCw69MWhxbhzD3NGi28osorUEgoMAdW0TfJzydhA4DMEyfPmvChHH5+fmrV6/wWg7uJAXuZWHxNrabZ4IRglBab1d/7yjA3t2xXLOyAXjl46fH189hrUm7QkoGqUDlTvp14f6XeB1ZESUwqc61MiWPAYTwAbBL2hBSMxNQp7Z/vvJvfy08vl8wDwDq7NZ2N16bkt/DI70ei9hjBzHrlpn24ruoZQZwIplEK4PWgOuNoiM2c+TuSdz43p82fXCvEOzPra4852XhCyV54jaBmn87pbvWPm2rdfIMHuzecJyJmIk8iyeZ55q0fZL/3ezI5e8ON/ZY1ESkNUkpCgvzNm1q/uyzzzMy0keOHMFMO5MvsfXWj1v0eoHuZjCCAaSUuL3xnVOBiAgohOkPFg9tnv4MsWuYhmb0hQuDRYM71syKxVrSS8d4HcsYSPgiKExMxgFAoBCADGygeLrlm9Vuy7k5+yGgQyrdDGVbqQBATAzsdZBGREBJsY1q0/v2/JvcRX9hexOQC0gIIDOG+Uc/IrNGA7nJFsbMgGg3rmj+6snOJR9xog0QSk/5u5VRtF3E7OTYA6kR3szt5tYMOxT+m6tYpAQGIIJgSgoBvPzaq2efezbunAjbRk8lCSwm5wu/+zK2hz/cqoAEpWTS/uyKPgec1/jeX1AFXX928c//mlFcqxLR1oY18Vh7IJQG0LPFEgOAIu2pWIEyQe7f6z55Z92MOwaeSkRCCFMYXswOATcnXyfbm5Gz9B619kVARGl5MWsRKDYrp5p9TwAmUDGWfiCNglW8reXrZ1q/fT7WuFJKKdDIP/zqYOGg7kSO/9Qelt7T75kteyo3aieMfECExYsXa607Ojp4y5qh73bxbfU+ESX7nCHL5JZ/O3UJnmYAANIsJPaKnTGSBhQ5+/4mc/jPdUeLI32BzDxmNnzBzMKa7lna4ofM7pzJ11pn37bszVH+4r/0O7kynL+t87OHvAEKQGC7Tdd/iF6vK2HJ1HKj+Giz5OcgfcmW+mAIFCDAbl695rnz3YYVSiWEkEKa4QE/zRz5CyYFKLeyQ39Y0CCilHKrQqcftLBNEaPAFSs3fPrZl31yS0LBMCJjr1SjHSm4bd9XSksp6hubHdfNz++DzJ4XK7kVJBEgEpEhtvBPEIBXdthQ35aTmyYQeyoHkpLMMAGQScuUTJmSafUSacBakQZGTSRACBRoeFIOV0Trb1v2ehqYd5X+YlB2mSd+vBN6hEmAl3mNvaKtmJhxEScaUPiMwiONwp/KrJGAArQLrD3njTAsAOhY8mHdG1fpjgYU3u5THCofX3TMrSikl0z4ffLZjN1XSf+ROkhiQIFKwYUXXBTwh6NdauTIMQistRZy+3JOe2Y5bFFSwwxakZBy3rz555z7m08++dirqNKkPZNNEwOAIQ1DSGbQ3W08enjhfvsd9vnnn//6nKl3//VPsldYjZObGAAK2fNzREweiZYCGFAwMJuGAQQEoIEMQNt1T84ZNy6/NumwUmCQBAGuBBAQV3bAMAAAQSPIZLNxEDL/cJk9wcibLEJFICwAZu0iCkDD27nObl7d+Mk9bXNf03bCME1vc6FQ4eC+Jz3oIcYT2wi4S4Rhz5jc/xmt5O129eyzr5xx+tSKsvKVK1d++PE7o0YO1FpLaSAIsYW5CI5Lpikcl/0mepjz9uHyHGKffPH5UUcdtWbNKr/f333bggikhGg0NmfOnEWLFjPzoEGDRo4cobX2GZKIGfGqq2+96fprK/v1W7Z0EbtRD2c7ml+tGSUCAGlobe1asGDB9K8/37BxnWX5R44Y89MjDjNNGUVOARSADhABmiCQQBJsbOmcs3Du/Pmzg6HAhLHj+tfUMCQMML3mRd37MSMAdqcUbnZRM+mOxe+vf+UyHW9DIZCBpUHKATSqz3/Pn53sGoFbhNh2S2T8mEGjGDRDXV1jbb/+paWVCbvTZ4kF82czuJo0opQogVEmH+4k9enqokmT9jtmylEX//ZCywIG0AoMA95++90jjz5q1qxZ1TUVth03fZZAAwH/9uAzTzz56BdffIxCBAKB6upqBDj2uGMuvvhigSARNMNhPzlu7ty5AFBUmDf98w97AiDbuWZFwhCk4aWX3rj3ngc+//xTISyGRHpmSlp6hpDmwQfsf+ftt3k8XrPWAAhSuXDvfX97/Kmn582aYfhMfyhQUlyExJddcukvfnEMehY7MBOhkKBdkEayFxqiTnQKK5DYtHj9a9MSdbMBEUB4abUgDSKd/5NrskefstmL9/2VA/9Yh6PZYW7pdDNz+xaU9Bs4dKIZTPvrvfcp5rhyFPOrb72hmBVpT7kozUrzyy//KyenyrTSn3j8eSZ2bHI12y4/98I/DCvw+ltva+auhK2YFfMfb/5zbn6p4UuTVuqJp56xaNkqxWxrtjW7zAlFilkz28SHTTkpu7AaMOWFf7xJmpXS216wq5Ui1sTvvvfZwEFjpBEWImXI8AlPPvNKc0fMYXaZFbOrvQ5UrBVrYkV88e+uycjpi1aKGQxPPf+CVZs22swOs61YEbvEXrCQmUkr0i4TeS/Sym5eXffGNSsf/+XiOw+afUXx3CvL5l5VPvfK0jlXFM+7snzVE2fE6uYyaY+xEek9sjQ/UtA4LrvELnNZ1ZBwRvGwUfvn5FfVDByqmF1mW/MHH39S3X+At/aOIm+1rrzyT4jpfUuGFRZVk2bXYdKccPiuex40rNBNt9zuEmvWivnbWUtLywcJIx1EqKxywNcz53qncpnjLje2dja3R+MuO5o0s8M8YvxBRihn0Mj9YrYXeafeV0ucvFrFfNIp50kj3efLDgSzHnjwcQ+CCeYo8+fffKOZNbOr2VXMmv/1z1lZGYMAM2Uga8zESSvXrlasFTsusyJet6G1K9qNFyYPNB5cOld8Hm9Y5nY1rXnhojlXls+eVjrnyvI5V5XNmVYy75rqOX/oO++6fs0zniXlkHI8uO0pxPxIQeO4rDTbigcNmxDJLBoyYr+y6sGAvsUrV3lLq4hR+u66737FHLPZ0ewSH3XMqSjTageM9Qdzf3XmBZrY1ayIb/3znYYV+tXZ59qKHWLFfMuf7wIM9imqRCv8s2NOcLux4q36S6++iWZg6q/PV8xR21XETz73spnaJ7OgavS+h9nEagvAMDE7zA7zynUbyqoGBMI5pj9SO3BE3aYWxexQUm5NPPAgKyXFZUooUpoV8XkXXS192QVFAwIp2VN/fa5idlnFlRN3lUv859sfNn0Zd9/3d809kobceBczN33zzJyrq+bfOHzBLWPmXF01e1rprCtKZ19VNeuKkjnTSmb9vnDezWM6Vn7FzEmgJGUM/d8EDTG7ipVmTTxg0FhfKHfg0InV/UYZgciz/3g5QWxrVsSn/fISlGGX2SW2XU44XFE13PJn9x84rrJ6mBXIWLO+2VNY0666zh+MHHb4FJdYESvi006/QIhQZc1g6Q//8ZY7XGaHuT3meHA885zzhOEvq6r1kNSVUN/Omo9WWIZyympHgpm2an2DZlbdz7+ryWGOEz/x/GtopuaVVvhSw4cdOUV1H+6ddvSE/YQvdP0tt7hMLrPj8sQDppjhkr7VQwOp6U89+4ztRF22427UIY4m+IgjTw4Ei/bd/4i4YsXdgk07TBTftGTe9QNnTyudPa10ztVVc6+tnXNV1dxr+s2eVv7t5UWz/1Ba9+Z1Kt7BzNq1uQcyWu/BZdoaNF7mEfPWEvg/ghhSxErzxvqu0vKBqekFNQPGlFcPDabm/OWeB1zmLsdVzAsWrTXMPmedc4lidolb28nyZw8fOfmEk84pKR0UCueeeMqZjmZX8wUX/176QoOHj467nhbjw474OZqR8pohZjD8xrvvdzluXHFCs03c3O4OH7Of9IfTsgsaWqMJzQmX5y5YZviDOcXlr//zi+rB48CfeeavL9TMLmtmdolc5gTz9bfeZYWySmsGG76UE08/I67JYe5MKJd5U1OsomYUiuCw0ePtbhU2ZNhE6UsvrhpqpWbPX7xcMdtK25pc5qVr6gsrBqMZrqgaahNHNXclHM3E5DITaVX/yQOzryibfUXZnCsrZ08rn3vtgNnTymf9vmzm5WWrnvx1dN1cTi4ckXK7c1X0nl2prUHjuu5/RcbYrqOYNPHrr3/uD+alZ5cOGDKhsLi/P5R1y5/vUt0sUjEPGzEJIP3bWcsTLi9ZtkGaGQcf+vOVq9rLKobXDhgrzHB9c3vM5lNOu8D0pxf2rUgoVsyO5n32+yka4ZoBo9AMfTljts1ss0d4+eXXP0yJ9I1klpjBjJnzljnMtub3P5xp+tNLK6vjzAnmcE5pXumAtOwCxWyTiju2zdzp8AW/uxYwUjN4nAhknHvJ773T2sQ28cdfzPQFC7Jzh0hf9lczZrvMDnG/gWODKXmlVYNSM/qsr29NuBxNcMJll/nOex5DI9OXUZGeX7apqcVhjmnvxonjzUyudhMtM/8x95oBc68eMPfq/nOmVc3+Q/nsP5SvfOSMjoXv9zCeHk3kgWbL598TWjEmtdsKa2vQ/DcEDHs63mX+zfmXAURKK4fWDBhTUj5QmOG/P/Zst6i3FfMddz4EGB41+lBFPH/RamGG95l0WNzm8y+82vDn+FPyz794WlzxlGNPRRmJZBWu2dDkEY4jjz0ZzUj1gBHSH37z/Y/izB2O663ib86/Goy0kvKBhi/9gYefcYgd4rvue0z4Iqed+RuXOab55DMvBF9G1aCxMpjhMCc0RxXHiM+68HKQodqh49AXueCyaV2KE8w2c5z4ulv+ir6MsppRwt/n9KkX2sRxxUNG7BdIzavsNxKt8Oq6Rk+FeYbVEUedgjK9qHIY+jI++OKbhNIOc4fD9z70cH1TI1MX6wQzx9bPm3tlvznTqudfP2LJnYdtfOfm+IaFpJW3eN1ihnvKNnpJGg9MmllRx8e68THq/IScDcx6Czz9+DlN3HZtl5XmeQtWF/cdKKyM6v6jBw/fN5San5Fd9NU3cxVzwtWKOaGouS0eTisyrMxPPpu3YNF6YUT2mXRIQnE0wdLMKKsakZZZsXh5w+lTL0ERRhH+4uv5HjX5/ZU3ogz1HzIGzdDfn3gmwdwci9rMnXEePOwAxJzq/qPRCp538R8cYpf5hFPOBSPlL/c84C3n9NlLQIbL+48Cf+a+hxzpwcJmnnLC6SBSa4aORSs89fyLekRXnPiQI05CmVneb1yf4gGZ+eWeCf2zo08WVkb/weNRhD/6bKbLHHPZIV67sbWkbLgRzB804kCU4TvuftBhVsz/+viTYaPHP/viPxxNTLZnOccbVm54746W2a/HG1aSVt3SRW8lYHrEjNa6Gy7EzNz2D168D88udWcUxr8tUAuHqObHmeK7JHW+CzSu6/bItz0ugTSxo5Ma5+JLrwKZmpbVt7r/6JoBowCCw0bu097peKxFMyeUdpmPOvYUwPA++/30kcf+ASJ1+KiJns46/awLrGBOQcnAE0+54MxzLjP8WWhGXnzlPc84f/r5N6xgVu3QseiLnHPRJZ6uSTD/480PQpGi1LSyIcMOBRHe/5BDHeaYw5HMIilTF61ab3NSbBRVDE7LLSutGQpmuL5ddSl+/rX30/MqwBepHT4eg+k/OfrnPTLmy1nzIzkl6MstrR5dUTsOReilN99LMF9341+ElTZgyDjpS7/19vt7Tn7nPY+gFUnLLes/bCL60s4857ceUkdPGFdUWrambqNOgoB6cb/NEmVrvbMNYnqBhplcXn0Cr7uUY/M4sZw6PlSrz4jNKXc23cVMTPb3BY2XfUdEH3zwwZ5VW0TsUtIp8smXs8prhoARLq8eXjNgXG5BtWGlX3zpVZ6OdzQRsavJIf7wk+kAwbKK4aPHHgQi0rd8gCcV2rpigXBOWdWI8qrRNf0n5hb0QzP95j/f68mYxlYXzfTy6uFZBRU1g0dHNceYEsxnnntpdkG/rJz+g4ceFEwp7z94vMv8wadfopEydNQEmzjO3KncBPP5l/wRzMzaQeMAQ+9//E2Xywf+9CQM9MkvG1oxYHRKdmG/YaN7ZMxvfnt5bnH1xAOmFFeMrBowAX3ZJ53xmwTznMWrUUYq+w23QpmTD53idiNmyvFnpufWFJYNqR06Do3A4VOOTWh+7oV3fKHI0ccdq5g0cyKR2LFip96aqOfZ7o2YbtAwk+KN13N8AbNmsns4DdVdrubX6K6vdl5DbR80PRc6aNCgzz77TGu9Rwiy7gWXpjbnyGNOASMtq09ZzcCRlbXD0IwUl/f/9ItZHtVwlPZuIqFdW3O/ASNz+pTX1I7NzasKpfZp7bAVs8P8uyuuQzO9unZ8aeXw6v5j0Yxc8vtrPDsl5vD4fX8STC/sN2Q8WuElazbYzKs2NhRVDLzmxnvH7TelsHh4Ud9hNf0nzFu8+qzzzjcDwZtvv8OzfdptJ6rp2/nLhJlVVD40FMm78to/LVy6Hqz0ASMOmDB5SmHF4LyyfiIl3BKzbea2hM7MryyuGPaPNz4rKh9aUTsmv7Q2NaswTmwz55fW5pUM7Fs9RPrDbQk3wfzex9Pz+va/7a7Hho89tG/ViPzSARMmHbpy3cbDfnoMGqE3337PQ8w2hg9p5XqIoB2PbRBDzEStL/PKo5k165hef569aKSqv4dJsWp359bQ2vO/l3pyHNdxHGaORCLXX3/9HjGpNJHt6oSiJMm46kbDl2cF8surRvcfPD4tuwjQd/5Fl9uKXWKHNnOzuOsktH3vgw8BplRUDS+vHCGMyNwFK23N3tmy86oLigdXVI+t7j8WzfTjTjzD7TZenn7+DTTTB4+ahP7MadfdajPf/8gz6E+fs2jjw4+8hZhbUzupsGTIVdf+qbxmEJqBxStXOkwOk62T5LS0Zmhabk1xxbD+g8deeMlVaEZu/PODjz7zDvgzawaPRml98vU3NvMTzz2PVmTMxCnNHTx4xGHpudWVA0aiL+XFN962madddxvK9Noh+6E//YVX3ogzXzLtShFIX70h9rtpf0Irp7R6dHnV6Gv+eLsVSBNWsDOaUMy2bW9rKntY2S5ithI5W4JGM7O75HBu+Asz643XO7OD0RkyPiOs2z9lcnnFL3jZwUzO7pvcHhPPyMiYPHnynpAu5BDHFXtw+dNfH8gqKJfBjLLqwf2HjCnoW4NWyvAx+8yev9jznzq9vN2uJpc55qiC4sqS0gEVVUOFEbn/b09631TMjzz2ohUo6DdgYlXtGDTC4/Y92FvsOLPNXD1oVH5pbXZh5dAxk9oTPOUXp8hgRmOHE9MsfdkVNaPKqkbUDhqDZqjfoGExpR3mLiehmRWzTfz7K28x/TkVteMq+o/qWzkQzNTnX303qjm/bGhR5RCZknXZ1ddGXXfSwYegz3/hZddENf/y7N+j2ady4BiU/iknnuyRp0B6cUn1iPTc6kOP/HmbnagZOiTSJzdOvGZjXAZyKweMrqgZUV49FETgkMOP9O7L3YFnZbskgb5z9Ggxd8WJ7upLmdlZcWJiVkpiTh97drZueopZ6xWnqrn9mdzdAY0mW2tNmqsq+/l8AU/e9Lj7dsOW1l6oiNlmfuiJl/oUDwJIyysZMmjkxNLqamEYBSWlDz36uMdOXNKa9ZYhQNbEF//2SsTQgIFjpBE++5zfamJHsavZ1bzPfoeHw1WDh0wKpeZX1gz1zmOzazN/8vUs4Yv0GzI2r2+/U6dekJFXml9S7fl/f3XORWimVvQbWl07XFqpZ55znrdU3m9rZkW8am1nMKVvTf+J1bXjcvKrpJn63sfTY5qfeeUdIyWvrHZkSfWw6269w/AHZCA4c96imOYnXngHfTkV/ffJKanOLCrqIh1luu/RZ9DIrBo0sbBs+NTzLhUhf8XA2gRTgnmfycf6UgtqB40prxkCMnjjrber5GXQjukg7SpuetST2/xG26yfMCvdNSsxu9iema4WTyCdYGeDO7uSV5+R5D27BJoeZ/MB+x/i94UaG5uZ2cPNrg6lyFM0LnNc8f2PPFNY3h/McE5RzaCR+1T3H2mF0tNzc6+/6WZbk63JCw5sfRIiRdzWEff5M6prhli+yIEHHeGFAhK26yhesWq9MCI1/cZn55YX9e2XcFkxJ5SytXKZz7v08kB6zpDR+5bWDDYC6aefdZ7bHSTK7FNcM3B4Vf/B0he66ro/OsQJpXsop8vsKD7osON8wYJ+A8dn51X6UrLmLV5uEzvMF15+pZWaM3jUPvlllegPXPi738U1xVxe1xDFQJ+C8mEVteNQBN/5+KMurWzmw4/5RXpuZf+h+xaVD0UzeOUN18VZu8yLlq8NZ/QdMGRcfkk1yOBjTz3ndpuK32lD7JQZux3ckEtuc3T+eFp/RdK5F52Z/PLas2lxDUVnMCV2jQhrrTz198vTpvqs4GOPPe6t/S6aReS4yiV2iV3NcZtv/vP9+cUDpC+zqLT/oOHjK2uHCSPoT0m7fNpVnXHb7X6st/szrtKO4nPP/20oJae4uKq0vMb7sqvIC0be+dcHAynZ+YXVKZE+Le0JxRx3FDMnXGUzn/jL061QJJSWYwbTnn/pDc8prJgXLFlh+FNS0rKkL/CXu+/1EON260SlSTE3t9mGlV47YHxeQU1WTmndplZbs60pofQFl1wu/WnC588tKvh69kybOaHZZa4ZNCGQVl49cCKKtAsvvcJmjillM48aP8nwZ6GRFs4onj5zrsscU45ifv3tf5q+jNz8cjRCr7/9T0exu7152Mrfsau+j17CRjOT23A3L6jlZSdw11ecWMYtL9GCA535lU7jg0wuk6Kd01DQTWUc0nzXXx/0+0LHHffzXQtKOy4xu4o8syhmc31L7LIr/piRVQpGWkFJ/8HDJ/atHCislFA4+/yLf9faGXWTD7T+jglwNSniW/98hzSDKeH0xuY2zZtNKs28sb4pkpmbmVuwev0mb+03H8hcV98w+ZDDTj7t9MbWdo8DeWTFIb7i6mtrBw354utvvKNULxaliRRzzKFgapY/mJndp6SxJaqYo7atmVymroRz6i/PvvyqqxxWMaZOV8WJf33RNDQzqgftG8ooGjF6v4TihNK20or52zkLJk0+7NwLfucRfJdJMXna8Fdnnzto2Cjv4l3aqWf8e4AmiRtuepjn1PL8/jyvhOaVuYvGu83PMMW92NYucBqltNZ63doNUqakpqR1dnYys+uqnWEtnhLpiQ199c38X5wyNT272OfLLK8cMXDwhIKiWhCpmTklV15zU1tH3Puy7cm1Le/fa9Sw+anyOA3zh598urZug2JOUvQe5tErIBVz3N7ncrs5Ss+r5323Gz0usaO03iozhsj79JtvZ1973U26RxYSMSdzcRRxQmmbnNZEPMb80lsfoC+npHpUUflww5/R0WVH446rve8nD/eSNHoEd89VeWfbNgi0I2TsKmi6e1/QFk5ht5nb36PWV9hesdnfQ5qZes//d4HGWxtFfOhPjvQFwn+56+6dwa/S2lHae2K8xXvg4eeGjdo/kJKbkVNSO3h0v0GjcvPLDV+4b3ntn/9yt62TE2S7W69Tb1G8VXSNesBBW8iD7qn3ZBupbR4RYna1dkm7pHt4pWb2nO2aSZF29fYniLyfY4o7ru7ODOz+SDvKdRS5mhzWcebGLuVPKygoH1I9aCyaqc+99Kqj2O0WoJrY1eRqcnuttde2QxMpIkXbMZO2taV3GzTMHI1Gk6Y76aSwIcXUw/t74Ym04zg7ExIHzaSI58xZZZipg4YM19+NFaVdTY7SPViZMXfur845J7egMhAszs3vP2DwfmVVw6xQpjCC+0w68IWXX407bvLLmnakjfSWY5tw5g5niph+oAiroxzHdVzlbt9V72VXMQ8ePdlMzR84fJLwRX5zwUU7JZx3hcN+f9BsFbzszgCMM3kBLs28bST834OGXc2XXX6NP5h69333atYJJ7GFuCZylHI1ucRRW3u27qaG6I233j1w6HgrmBWK5JVWDi6vHpqWXST9aQV9q845/+KVa9er7otyNX23dOkZP0SQa2fGLnkvveRORXz2+dPQn91vyPi0rOLhYyY4xHHne3lBd2Azf1/QbIWbHh20rW9wJ8+GmlkTDx06dPXqlQsXzs/Ny2HNUphEZJomd/cbBgSldDzKD9z/+BtvvvHVV9Mty8rKyvT5/O3t7c2t60Op8rDDDjvlpFP2339/0xBKkyEFaTKkwH9XaL1L1Te8vQo93q0+sVtdwE4erggQ4cXnPznltJOKy4pcu7OttWnNmuXBYIBJ9e7BvptdxvZo/eFW98hbFlFs235mZ37XIAAhsKGxyXFJk5TC71VXCJlsOaQJPvvsq/fff//tt99esXw1kfD7rYKirGg0un798tRI6ujRo39xwpU/O+LQSDjVK1YiYgkgmKUUO1PIvS16eCcKa3bmqG2quHnne2LsqBJPCFi3ru2kk48v6lsgUa/dWPfFF5+EUoLadX2m+T3X+IcuPtylCdkhaLxzFBf3bW6YddyxJ519zq/79Mmr27Rx44aGurq6OXPmLF26NJFIAJIQwu/3tbe2uAoZnAkTxh1z9NFHHHF4KBTwSumJGJiFQCFwl4rLt5UZe6zcrpcE2tUzb4sh6m4iOXr0yNw+mZaBSxYv+NtD9w7sX6sc12+Z8L8x0NEkBL773gfHHH2cbbsohbbdQCTVjsbAkJZlAUAiHgdy07KyigvyD/vJIZMnTx4/dpxhCNLkNShiYgQUAve4OP1PT8eW8N2i0zYny8cnTDhwztx5lZWVCxbO//Wvz77t9psEABD9x9oh/KDzubNluY5iAJz57Zzrr79hwaKFCScRs+OGYZimNE2zf/9+w4cPHztuzPgxY8MpKZs7UJEG4mQ/zj0nVH88oNlKxniIOe20c5577vmqmqolS5YceujBLzz/jGEAaW38u8aO/9dAwwCOo01LeoyksamlKxZFxHA4nJqaaohkLxevFQpoQgSB4gfSvj9C0DAnN+G45pqbb775lurqmqXLFw8aXPvll58LAK2VKQ34sY4fCjTdRoFGsf2u9B5fQWDcI5XAP1bQ7AgxmkEg3HHH/Zdf/vuamprVq1fn9slYsnQ+Airl9jaX+IfcAe/HCJqe3/DatHj7lQkhbNv2+Xw/2pv8YREDoDUIAU888eIvTzut/4ABGzZsCIUCixbPCwSsrRDzvwuavaM3YlwNBsKTT74y9axfVVZWbNiwIRDwzZk7KzU1JAQYAndkqf3fHsZecOwIMbYC04AnH+9BzPpAILB02WLDEP/LiIHv17H1/+wgAA1gSnjs0RemTp1aWVm5YsWKgoKCteuW7UXMXtBsR8AQsGZAgNtuu++ss86qrCpfMH/eyJHDZ8+ZrhRvFzE/QirzgxOlvWNzAgqTrUkxn/Xr30qZXlE5BDF0+hm/0cy2S+42Ib093pDh/4uxFzS9YtfdWV2HHn4sypSKyiGIgdvuuNtDjNomwvxDNGT4/2L8z1lPXhPkRCLh9/t7OXy93s64sa5t/Pjx7a0dhimUct95943Ro4cpTYbYOkbibYn4v6WV/kc4Tc9GqZtvWAgA6EEMEREQI5LCe+5+uLq6OhaPdnY2Dxrcr76hbtSovYj5XwJN75SlHeHJdR0hSAAl4uroo0658LwLXcdhre686/b333/HtJCITLkXMf8bRFhr/R0VW17eak9q7J1/uTscyUWRKo3w0cec1NLWFY07inm7tRL/rdzCvUT4hzeCtlcV2pPsmMwu1vzRB18PHTweIWSYkX32PfTDj7603R1mv/8Xs1H3gua/ZBx5690tXd54459DBo+WImjIwAH7H/L6m++4mhVzwlXbFTC7mnq913r6/54LexREa710yZoH73/srrvvBCDTEued95tfnn5KTU0VoWc/odzeXuL/aw7fvQHLJCP+wx8uf+mll1yXI5GMnxz2k+OPP3bAwP6IKARorVCiQImwFxZ7QdNrNDbWp6ene9vHbTUDsBcre0GzA/2yeQdvIvJ2IdyrcXZv/D/LeE6XwLnBZgAAAABJRU5ErkJggg==';

const CONSENT_TEXT = {
  "sections": [
    {
      "key": "house",
      "title": "House rules",
      "paras": [],
      "items": [
        "Check-in and check-out times must be followed unless prior permission is obtained.",
        "The property is provided for the number of guests declared at the time of booking. Additional guests require prior approval.",
        "Guests are requested to maintain cleanliness and take care of the property, furniture, appliances and other facilities.",
        "Any damage, breakage or loss caused by a guest will be chargeable.",
        "Please switch off lights, air conditioners, fans and electrical appliances when not required.",
        "Smoking is not permitted inside rooms or enclosed areas. Cigarette butts must not be discarded on the beach or property.",
        "Alcohol consumption, where permitted by law, must be responsible and must not disturb other guests or neighbours.",
        "Loud music, parties, shouting or activities disturbing neighbours or other guests are not permitted.",
        "Illegal activities, possession or use of prohibited substances, weapons or other unlawful activities are strictly prohibited.",
        "Guests are responsible for their personal belongings. The management is not responsible for loss or damage to valuables left unattended.",
        "Children must be supervised by their parents/guardians at all times, particularly around the beach, balconies, stairs and water.",
        "Pets are allowed only with prior approval and must be supervised by their owners. Pet owners are responsible for cleaning up after their pets.",
        "Cooking, where kitchen facilities are provided, must be done safely. Gas/electrical appliances must be switched off after use.",
        "Do not move furniture or outdoor equipment to the beach without permission.",
        "Please do not take property items, towels, furniture or equipment onto the sea or beach unless specifically permitted."
      ],
      "ack": "I/We have read and agree to the House Rules."
    },
    {
      "key": "sea",
      "title": "Beach & sea safety",
      "paras": [
        "Swarga by the Bay is a beachfront property. The sea is a natural environment and conditions can change rapidly. Guests acknowledge that entering the sea is at their own risk."
      ],
      "items": [
        "There may be strong currents, waves, sudden changes in water depth and underwater hazards.",
        "Swimming or entering the sea should be avoided during rough weather, heavy rain, storms, high waves or strong currents.",
        "Do not enter the sea after consuming alcohol or any substance that may impair judgment or coordination.",
        "Children must never enter the sea or play near the water without direct adult supervision.",
        "Never swim alone. Stay within your ability and remain close to shore.",
        "Do not venture into deeper water, rocks, fishing areas or restricted areas.",
        "Do not attempt to rescue another person from the sea by entering the water unless you are trained to do so. Call for professional assistance immediately.",
        "Guests should follow warnings from local authorities, lifeguards or property staff regarding sea conditions.",
        "Beach toys, bodyboards, life jackets or other equipment provided by the property must be used responsibly and only for their intended purpose.",
        "Life jackets are not a substitute for supervision or swimming ability.",
        "Equipment must be returned after use and any damage must be reported immediately.",
        "Avoid the sea during lightning, thunderstorms or other dangerous weather conditions.",
        "At night, guests are advised not to enter the sea, as visibility and awareness of currents and hazards are significantly reduced.",
        "Do not consume food or alcohol while swimming or engaging in water activities.",
        "Please be alert for sharp objects, shells, rocks, fishing equipment and other hazards on the beach.",
        "The beach is a natural environment. Guests should not disturb marine life or remove shells, creatures or other natural material."
      ],
      "ack": "I/We have read and understood the Beach & Sea Safety guidelines and accept that entering the sea is at my/our own risk."
    },
    {
      "key": "weather",
      "title": "Good to know",
      "blocks": [
        {
          "title": "Emergency & safety",
          "paras": [
            "In case of an emergency:"
          ],
          "items": [
            "Immediately inform the property caretaker/management.",
            "Call 112 for emergency assistance where required.",
            "For a medical emergency, seek professional medical assistance immediately.",
            "In case of a fire, evacuate the building and inform the caretaker/management immediately.",
            "Do not attempt to handle dangerous electrical, gas or fire-related situations unless you are trained to do so."
          ]
        },
        {
          "title": "Weather & natural conditions",
          "paras": [
            "Guests acknowledge that beachfront properties are exposed to natural conditions including:",
            "Such natural conditions are beyond the reasonable control of the property management.",
            "Management may restrict beach or sea access whenever conditions are considered unsafe."
          ],
          "items": [
            "Strong winds",
            "Heavy rain and storms",
            "High waves and strong currents",
            "Lightning and thunderstorms",
            "Temporary power or internet interruptions",
            "Sand, salt and moisture",
            "Insects and other natural wildlife"
          ]
        },
        {
          "title": "Respect for the property & environment",
          "paras": [
            "Guests are requested to:"
          ],
          "items": [
            "Keep the beach and property clean.",
            "Use waste bins provided.",
            "Avoid plastic or other waste entering the sea.",
            "Respect local residents, fishermen and other beach users.",
            "Avoid unnecessary disturbance to marine life.",
            "Conserve water and electricity.",
            "Report leaks, electrical problems or other safety concerns immediately."
          ]
        }
      ],
      "ack": "I/We acknowledge the Weather & Natural Conditions."
    },
    {
      "key": "liability",
      "title": "Liability & acknowledgement",
      "paras": [
        "I/We confirm that I/we have read and understood the above house rules and sea-safety guidelines.",
        "I/We understand that the property is located directly beside the sea and that the sea, beach, weather and surrounding natural environment involve inherent risks.",
        "I/We agree to exercise reasonable care and accept responsibility for our own safety and the safety of children/minors under our supervision.",
        "I/We understand that parents/guardians remain responsible for children and that the property staff cannot provide continuous supervision of guests or children.",
        "I/We agree to follow instructions given by the property management/caretaker concerning safety, weather conditions and access to the beach or sea.",
        "I/We further agree to compensate the property for any damage caused by me/us through negligence, misuse or violation of the house rules."
      ],
      "items": [],
      "ack": "I/We accept the Liability & Acknowledgement above."
    }
  ],
  "extra": {
    "group": "I confirm that I have communicated the relevant house rules and sea-safety instructions to all members of my group.",
    "data": "I consent to Swarga by the Bay storing the details and ID proof above for guest registration and safety purposes during and after my stay.",
    "signature": "I agree that typing my name above is my signature on this declaration. Date and time are recorded on submission."
  }
};

/* ---------- check-in PDF ---------- */

function pdfEsc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function pdfFile_(fileId) {
  if (!fileId) return null;
  try {
    const f = DriveApp.getFileById(fileId), blob = f.getBlob();
    return { mime: blob.getContentType(), name: f.getName(), data: Utilities.base64Encode(blob.getBytes()) };
  } catch (e) { return null; }
}

function pdfSection_(sec) {
  let h = '<h3>' + pdfEsc_(sec.title) + '</h3>';
  const block = (b) => {
    let o = b.title ? '<h4>' + pdfEsc_(b.title) + '</h4>' : '';
    const paras = b.paras || [], items = b.items || [];
    if (paras[0]) o += '<p>' + pdfEsc_(paras[0]) + '</p>';
    if (items.length) o += '<ol>' + items.map(i => '<li>' + pdfEsc_(i) + '</li>').join('') + '</ol>';
    paras.slice(1).forEach(p => { o += '<p>' + pdfEsc_(p) + '</p>'; });
    return o;
  };
  h += sec.blocks ? sec.blocks.map(block).join('') : block({ paras: sec.paras, items: sec.items });
  return h;
}

/** Builds the check-in record + signed consent + ID proofs as one PDF. */
function checkinPdf_(submissionId, sess) {
  const c = checkinRow_(submissionId).obj;
  const others = readAll_(GUESTS, GUEST_HEADERS).filter(g => g['Submission ID'] === submissionId);
  const s = getSettings_();
  const v = (k) => pdfEsc_(c[k] || '—');
  const version = c['Consent Version'] || CONSENT_VERSION;
  const accepted = (label) => '<div class="ack"><span class="tick">✔</span> <b>Accepted:</b> ' + pdfEsc_(label) + '</div>';
  const row = (k, val) => '<tr><th>' + pdfEsc_(k) + '</th><td>' + val + '</td></tr>';

  const idImgs = [], attachments = [];
  const addId = (label, fileId) => {
    const f = pdfFile_(fileId);
    if (!f) { idImgs.push({ label: label, html: '<p class="muted">No ID file on record.</p>' }); return; }
    if (f.mime === 'application/pdf') {
      attachments.push({ label: label, name: f.name, mime: f.mime, data: f.data });
      idImgs.push({ label: label, html: '<p class="muted">ID proof was supplied as a PDF file (' + pdfEsc_(f.name) + '). It is downloaded alongside this document.</p>' });
    } else {
      idImgs.push({ label: label, html: '<img class="idimg" src="data:' + f.mime + ';base64,' + f.data + '">' });
    }
  };
  addId('Guest 1 · ' + (c['Guest Name'] || '') + ' · ' + (c['ID Type'] || ''), c['ID Photo File ID']);
  others.forEach(g => { if (g.Kind === 'Adult' || g['ID Photo File ID']) addId('Guest ' + g['No.'] + ' · ' + g.Name + (g['ID Type'] ? ' · ' + g['ID Type'] : ''), g['ID Photo File ID']); });

  const guestRows = '<tr><td>1</td><td>' + v('Guest Name') + ' <span class="muted">(primary)</span></td><td>Adult</td><td>' + v('ID Type') + (c['ID Number'] ? ' · ' + v('ID Number') : '') + '</td></tr>' +
    others.map(g => '<tr><td>' + pdfEsc_(g['No.']) + '</td><td>' + pdfEsc_(g.Name) + '</td><td>' + (g.Kind === 'Child' ? 'Child, age ' + pdfEsc_(g.Age) : 'Adult') + '</td><td>' +
      (g['ID Type'] ? pdfEsc_(g['ID Type']) + (g['ID Number'] ? ' · ' + pdfEsc_(g['ID Number']) : '') : '—') + '</td></tr>').join('');

  const sec = CONSENT_TEXT.sections, ex = CONSENT_TEXT.extra;
  const html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Helvetica,Arial,sans-serif;font-size:10.5pt;color:#17252b;line-height:1.45}' +
    'table.brand{border-bottom:3px solid #2aa6a8;margin:0 0 6px}table.brand td{border:0;vertical-align:middle;padding:0 0 6px}.brand td.logo{width:130px}' +
    '.brand .lh{text-align:right;color:#0b3d52}.brand b{font-family:Georgia,serif;font-size:18pt}.brand i{font-family:Georgia,serif;font-size:12pt;color:#11607a}' +
    '.brand small{display:block;color:#62727a;font-size:9pt;margin-top:2px}' +
    'h2{font-family:Georgia,serif;color:#0b3d52;font-size:14pt;margin:18px 0 6px;border-bottom:2px solid #2aa6a8;padding-bottom:3px}' +
    'h3{font-family:Georgia,serif;color:#0b3d52;font-size:12pt;margin:14px 0 4px}h4{margin:8px 0 2px;font-size:10.5pt}' +
    'table{width:100%;border-collapse:collapse;margin:4px 0}th,td{text-align:left;vertical-align:top;padding:4px 6px;border-bottom:1px solid #e3e7e8;font-size:10pt}th{width:34%;color:#62727a;font-weight:normal}' +
    'table.g th{width:auto;color:#0b3d52;font-weight:bold;background:#e6f5f4}' +
    'ol{margin:2px 0 6px 18px;padding:0}li{margin:1px 0}p{margin:3px 0}' +
    '.ack{background:#e8f4ec;border-left:4px solid #1f8a5b;padding:6px 10px;margin:6px 0 10px}.tick{color:#1f8a5b}' +
    '.sig{border:1px solid #cfd8da;border-radius:6px;padding:10px 14px;margin-top:8px}.sig .name{font-family:Georgia,serif;font-style:italic;font-size:20pt;color:#0b3d52}' +
    '.muted{color:#62727a}.page{page-break-before:always}.idimg{max-width:100%;max-height:22cm;border:1px solid #cfd8da}' +
    '.foot{margin-top:14px;font-size:8.5pt;color:#62727a}' +
    '</style></head><body>' +
    '<table class="brand"><tr><td class="logo"><img src="data:image/png;base64,' + PDF_LOGO_B64 + '" width="120"></td>' +
    '<td class="lh"><b>Swarga</b> <i>by the Bay</i><small>Kodi Beach, Udupi, Karnataka · ' + pdfEsc_(s.propertyPhone) + '</small><small>Guest check-in record &amp; signed declaration</small></td></tr></table>' +

    '<h2>Check-in record</h2><table>' +
    row('Reference', v('Submission ID')) + row('Submitted', v('Submitted At') + ' (IST)') +
    row('Booking', v('Booking ID')) +
    row('Check-in', v('Check-in Date') + ' · ' + v('Check-in Time')) + row('Check-out', v('Check-out Date') + ' · ' + v('Check-out Time')) +
    row('Primary guest', v('Guest Name')) + row('Mobile', v('Mobile')) + row('Email', v('Email')) +
    row('Guests', v('Adults') + ' adult(s), ' + (c.Children || '0') + ' child(ren)') +
    row('Vehicles', (Number(c.Vehicles) || 0) ? v('Vehicles') + (c['Vehicle Numbers'] ? ' · ' + v('Vehicle Numbers') : '') : 'None') +
    row('Emergency contact', v('Emergency Contact Name') + ' · ' + v('Emergency Contact No.')) +
    row('ID verified by staff', c.Status === 'Verified' ? v('Rep Name') + ' · ' + v('Rep Verified At') : 'Not yet verified') +
    row('Stay status', v('Stay Status') + (c['Actual Check-in'] ? ' · in ' + v('Actual Check-in') : '') + (c['Actual Check-out'] ? ' · out ' + v('Actual Check-out') : '')) +
    '</table>' +
    '<h3>All guests</h3><table class="g"><tr><th>#</th><th>Name</th><th>Type</th><th>ID</th></tr>' + guestRows + '</table>' +

    '<div class="page"></div><h2>Declarations accepted by the guest</h2>' +
    '<p class="muted">The guest read and accepted each section below on the online check-in form before submitting. Form text version ' + pdfEsc_(version) + '.</p>' +
    pdfSection_(sec[0]) + accepted(sec[0].ack) +
    pdfSection_(sec[1]) + accepted(sec[1].ack) +
    pdfSection_(sec[2]) + accepted(sec[2].ack) +
    pdfSection_(sec[3]) + accepted(sec[3].ack) +
    (c['Group Booking'] === 'Yes' ? '<h3>Group booking</h3><p>' + pdfEsc_(ex.group) + '</p>' + accepted('Group booking · lead guest ' + (c['Lead Guest Name'] || c['Guest Name'])) : '') +
    '<h3>Data consent</h3>' + accepted(ex.data) +

    '<h3>Signature</h3><div class="sig"><div class="name">' + v('Declaration Name') + '</div>' +
    '<div class="muted">' + pdfEsc_(ex.signature) + '</div>' +
    '<div>Signed electronically on ' + v('Submitted At') + ' IST · Reference ' + v('Submission ID') + '</div></div>' +

    idImgs.map(x => '<div class="page"></div><h2>ID proof · ' + pdfEsc_(x.label) + '</h2>' + x.html).join('') +

    '<div class="foot">Generated ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'd MMM yyyy, HH:mm') + ' IST by ' + pdfEsc_(sess.name) + '. Confidential: contains identity documents. Store and share only for guest registration and safety purposes.</div>' +
    '</body></html>';

  const pdf = Utilities.newBlob(html, 'text/html', submissionId + '.html').getAs('application/pdf');
  const name = 'Check-in ' + submissionId + ' ' + String(c['Guest Name'] || '').replace(/[^\w ]+/g, '').trim() + '.pdf';
  audit_(sess, 'checkin.pdf', submissionId, 'PDF generated' + (attachments.length ? ' + ' + attachments.length + ' PDF ID file(s)' : ''));
  return { ok: true, name: name, data: Utilities.base64Encode(pdf.getBytes()), attachments: attachments };
}
