from functools import partial
import concurrent.futures as cf
from scipy.stats import norm
import numpy as np
from scipy.linalg import svd


try:
    from joblib import Parallel, delayed 
    _HAVE_JOBLIB = True
except Exception:
    _HAVE_JOBLIB = False

# Compute the full SVD of matrix A and returns the top k singular values.
def truncated_svd(A, k=None, include_u_v=False):
    S = svd(A, compute_uv=False, full_matrices=False)
    if k is None:
        k = len(S)
    S_k = S[:k]
    if include_u_v:
        U, _, Vh = svd(A, full_matrices=False)
        return S_k, U[:, :k], Vh[:k, :]
    return S_k


# Return the log-likelihood for a given q
def compute_ll_for_q(sv: np.ndarray, p: int, q: int):
    q = int(q)
    S1 = sv[:q]
    S2 = sv[q:]

    if len(S2) == 0 or p <= 2:
        return (q, float(-np.inf))

    mu1 = np.mean(S1) if len(S1) else 0.0
    mu2 = np.mean(S2) if len(S2) else 0.0

    if len(S1) > 1:
        s1_squared = np.var(S1, ddof=1)
    else:
        s1_squared = 0.0

    if len(S2) > 1:
        s2_squared = np.var(S2, ddof=1)
    else:
        s2_squared = 0.0

    sigma2 = ((q - 1) * s1_squared + (p - q - 1) * s2_squared) / (p - 2)
    if not np.isfinite(sigma2) or sigma2 <= 0:
        return (q, float(-np.inf))

    sigma = np.sqrt(sigma2)

    ll = 0.0
    if len(S1):
        ll += float(np.sum(norm.logpdf(S1, mu1, sigma)))
    if len(S2):
        ll += float(np.sum(norm.logpdf(S2, mu2, sigma)))

    return (q, ll)

# Estimate the embedding dimension using the profile likelihood method
def embedding_dimension(singular_values, k=None, n_jobs: int = -1):
    if k is None:
        k = len(singular_values)

    sv = np.array(singular_values[:k], dtype=float)
    p = len(sv)

    if p <= 2:
        return 1

    qs = list(range(1, p))

    if n_jobs == 1:
        best_ll = float(-np.inf)
        d_hat = 1
        for q in qs:
            _, ll = compute_ll_for_q(sv, p, q)
            if ll > best_ll:
                best_ll = ll
                d_hat = q
        return d_hat

    if _HAVE_JOBLIB:
        results = Parallel(n_jobs=n_jobs, backend="loky")(
            delayed(compute_ll_for_q)(sv, p, q) for q in qs
        )
    else:
        max_workers = None if n_jobs in (None, -1) else int(n_jobs)
        func = partial(compute_ll_for_q, sv, p)
        with cf.ProcessPoolExecutor(max_workers=max_workers) as ex:
            results = list(ex.map(func, qs))

    if not results:
        return 1

    best_q, _best_ll = max(results, key=lambda t: t[1])  # type: ignore
    return int(best_q)